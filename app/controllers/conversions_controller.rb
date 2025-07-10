require "zip"
require "pdf-reader"
require "caracal"
require "securerandom"
require "convert_api"
require "axlsx"
require "mini_magick"


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

  def convert_pdf_to_ppt
    uploaded_file = params[:files].first

    unless uploaded_file&.respond_to?(:original_filename)
      return render json: { error: "No valid file uploaded" }, status: :unprocessable_entity
    end

    document = Current.session.user.documents.create!(
      title: "PDF To PPT - #{Time.current.strftime('%Y-%m-%d %H:%M:%S')}"
    )
    document.uploads.attach(uploaded_file)

    # Ensure we can re-read the file
    uploaded_file.rewind

    temp_path = Rails.root.join("tmp", uploaded_file.original_filename)
    File.open(temp_path, "wb") { |f| f.write(uploaded_file.read) }

    result = ::ConvertApi.convert("pptx", { File: temp_path.to_s })

    output_file_path = Rails.root.join("tmp", "converted_#{Time.current.to_i}.pptx")
    result.files.first.save(output_file_path)

    document.file.attach(
      io: File.open(output_file_path),
      filename: "converted.pptx",
      content_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )

    send_file output_file_path,
              type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              filename: "converted.pptx",
              disposition: "attachment"

  rescue => e
    Rails.logger.error("Conversion error: #{e.message}")
    render json: { error: "Conversion failed", details: e.message }, status: :internal_server_error
  end

  def convert_pdf_to_excel
    uploaded_files = Array.wrap(params[:files])

    if uploaded_files.empty?
      return render json: { error: "No files uploaded." }, status: :unprocessable_entity
    end

    excel_paths = []
    document = Current.session.user.documents.create!(
      title: "PDF To Excel - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
    )
    uploaded_files.each_with_index do |uploaded_file, index|
      next unless uploaded_file.content_type == "application/pdf"

      pdf_path = uploaded_file.tempfile.path
      xlsx_filename = "converted_#{index + 1}_#{Time.now.to_i}.xlsx"
      xlsx_path = Rails.root.join("tmp", xlsx_filename)
      document.uploads.attach(uploaded_file)
      # Extract text from PDF
      reader = PDF::Reader.new(pdf_path)
      all_lines = []
      reader.pages.each do |page|
        lines = page.text.lines.map(&:strip).reject(&:empty?)
        all_lines.concat(lines)
      end

      # Generate Excel
      Axlsx::Package.new do |p|
        p.workbook.add_worksheet(name: "PDF Data") do |sheet|
          all_lines.each do |line|
            sheet.add_row line.split(/\s{2,}|\t|  +/)
          end
        end
        p.serialize(xlsx_path)
      end

      excel_paths << xlsx_path
    end

    if excel_paths.empty?
      return render json: { error: "No valid PDF files to process." }, status: :unprocessable_entity
    end

    # Create zip archive
    zip_filename = "converted_excels_#{Time.now.to_i}.zip"
    zip_path = Rails.root.join("tmp", zip_filename)

    Zip::File.open(zip_path, Zip::File::CREATE) do |zipfile|
      excel_paths.each do |xlsx_path|
        zipfile.add(File.basename(xlsx_path), xlsx_path)
      end
    end
    document.file.attach(
      io: File.open(zip_path),
      filename: zip_filename,
      content_type: "application/zip"
    )
    send_file zip_path,
              filename: zip_filename,
              type: "application/zip",
              disposition: "attachment"
  end

  def convert_pdf_to_jpg
    uploaded_files = Array.wrap(params[:files])
    return render json: { error: "No files uploaded." }, status: :unprocessable_entity if uploaded_files.empty?

    temp_dir = Rails.root.join("tmp", "pdf_to_jpg_#{Time.now.to_i}")
    FileUtils.mkdir_p(temp_dir)
    image_paths = []
    document = Current.session.user.documents.create!(
      title: "PDF To JPG - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
    )
    uploaded_files.each_with_index do |uploaded_file, file_index|
      next unless uploaded_file.content_type == "application/pdf"

      pdf_path = uploaded_file.tempfile.path
      document.uploads.attach(uploaded_file) # Attach the original PDF to the document in active storage
      # Use MiniMagick to convert each page to a JPG
      MiniMagick::Tool::Convert.new do |convert|
        convert.density(150)
        convert.quality(90)
        convert << "#{pdf_path}"
        convert << "#{temp_dir}/file_#{file_index}_page_%02d.jpg"
      end

      # Collect generated JPGs
      Dir.glob("#{temp_dir}/file_#{file_index}_page_*.jpg").each do |jpg_path|
        image_paths << jpg_path
      end
    end

    if image_paths.empty?
      return render json: { error: "No valid PDF pages converted." }, status: :unprocessable_entity
    end

    # Create zip file
    zip_path = Rails.root.join("tmp", "pdf_pages_#{Time.now.to_i}.zip")
    Zip::File.open(zip_path, Zip::File::CREATE) do |zipfile|
      image_paths.each do |img|
        zipfile.add(File.basename(img), img)
      end
    end
    # Attach the zip file to the document active storage
    document.file.attach(
      io: File.open(zip_path),
      filename: "converted_images.zip",
      content_type: "application/zip"
    )
    send_file zip_path, filename: "converted_images.zip", type: "application/zip"
  end

  def convert_jpg_to_pdf
    jpgs = Array(params[:files]) # wrap in Array to be safe
    pdf = CombinePDF.new

    document = Current.session.user.documents.create!(
      title: "JPG To PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
    )

    jpgs.each do |jpg|
      image = MiniMagick::Image.read(jpg)
      image.format("pdf")
      document.uploads.attach(jpg) # Attach the original JPG to the document in active storage
      temp_path = Rails.root.join("tmp", "#{SecureRandom.uuid}.pdf")
      image.write(temp_path)

      pdf << CombinePDF.load(temp_path)

      File.delete(temp_path) if File.exist?(temp_path)
    end

    output_path = Rails.root.join("tmp", "combined_#{SecureRandom.uuid}.pdf")
    pdf.save(output_path)
    # Attach the combined PDF to the document in active storage
    document.file.attach(
      io: File.open(output_path),
      filename: "combined_images.pdf",
      content_type: "application/pdf"
    )
    send_file output_path, type: "application/pdf", disposition: "attachment"
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
