require "zip"
require "pdf-reader"
require "caracal"
require "securerandom"
class ConversionsController < ApplicationController
  def convert_pdf_to_word
    uploaded_files = params[:files]
    return head :bad_request if uploaded_files.blank?

    document = Current.session.user.documents.create!(title: "PDF To Word - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}")

    uid = SecureRandom.uuid
    pdf_dir = Rails.root.join("tmp", "pdfs", uid)
    docx_dir = Rails.root.join("tmp", "docxs", uid)
    zip_path = Rails.root.join("tmp", "converted_docs_#{uid}.zip")

    FileUtils.mkdir_p(pdf_dir)
    FileUtils.mkdir_p(docx_dir)

    uploaded_files.each do |file|
      pdf_path = pdf_dir.join(file.original_filename)
      File.open(pdf_path, "wb") { |f| f.write(file.read) }

      # Save original PDF as DocumentUpload
      document.uploads.attach(File.open(pdf_path))

      docx_filename = File.basename(file.original_filename, File.extname(file.original_filename)) + ".docx"
      docx_path = docx_dir.join(docx_filename)

      convert_pdfs_to_docx(pdf_path.to_s, docx_path.to_s)
    end

    # Create ZIP
    Zip::File.open(zip_path, Zip::File::CREATE) do |zipfile|
      Dir.glob("#{docx_dir}/*.docx").each do |docx|
        zipfile.add(File.basename(docx), docx)
      end
    end

    # Attach ZIP to the document as the main file
    document.file.attach(io: File.open(zip_path), filename: "converted_documents.zip", content_type: "application/zip")

    # Return the ZIP for download
    send_data File.read(zip_path),
              filename: "converted_documents.zip",
              type: "application/zip",
              disposition: "attachment"

  ensure
    FileUtils.rm_rf([ pdf_dir, docx_dir ])
    File.delete(zip_path) if File.exist?(zip_path)
  end


  private

  def convert_pdfs_to_docx(pdf_path, output_path)
    text = ""

    begin
      reader = PDF::Reader.new(pdf_path)
      reader.pages.each do |page|
        text << page.text
        text << "\n\n"
      end

      Caracal::Document.save(output_path) do |docx|
        docx.p text
      end
    rescue => e
      Rails.logger.error "Error converting #{pdf_path} to DOCX: #{e.message}"
    end
  end
end
