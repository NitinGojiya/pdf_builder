class DocumentsController < ApplicationController
  require "securerandom"
  require "combine_pdf"
  require "zip"
  def index
  end

  def fileview
    @documents = Current.session.user.documents.with_attached_uploads.with_attached_file.order(created_at: :desc)
  end


  def combine
   uploaded_files = params[:files] # => array of ActionDispatch::Http::UploadedFile
    return render json: { error: "No files provided" }, status: :unprocessable_entity if uploaded_files.blank?

    merged_pdf = CombinePDF.new

    uploaded_files.each do |file|
      merged_pdf << CombinePDF.parse(file.read)
    end

    # Save merged PDF to a tempfile for attachment
    merged_pdf_file = Tempfile.new([ "merged", ".pdf" ], binmode: true)
    merged_pdf_file.write(merged_pdf.to_pdf)
    merged_pdf_file.rewind

    # Create a Document associated with current_user
    document = Current.session.user.documents.create!(title: "Merged PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}")

    # Attach the original uploads (optional)
    uploaded_files.each do |file|
      document.uploads.attach(file)
    end

    # Attach the merged PDF
    document.file.attach(
      io: merged_pdf_file,
      filename: "merged.pdf",
      content_type: "application/pdf"
    )

    merged_pdf_file.close
    merged_pdf_file.unlink # Deletes the temp file

    # render json: { message: "PDFs merged successfully", document_id: document.id }, status: :ok
    send_data merged_pdf.to_pdf,
          filename: "pdfBuilder_merged.pdf",
          type: "application/pdf",
          disposition: "attachment"
  end

  def pdf_compress
  end
  def compress
    uploaded_files = params[:files]
    compression_level = params[:level]
    allowed_levels = %w[screen ebook printer prepress default]
    level = compression_level.presence_in(allowed_levels) || "ebook"

    unless uploaded_files.present? && uploaded_files.all? { |f| f.content_type == "application/pdf" }
      render plain: "Invalid file(s)", status: :bad_request and return
    end

    compressed_paths = []

    uploaded_files.each do |uploaded_io|
      original_path = Rails.root.join("tmp", "#{SecureRandom.hex}_original.pdf")
      compressed_path = Rails.root.join("tmp", "#{SecureRandom.hex}_compressed.pdf")

      File.open(original_path, "wb") { |f| f.write(uploaded_io.read) }

      gs_command = <<~CMD
        gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/#{level} \
        -dNOPAUSE -dQUIET -dBATCH -dSAFER \
        -sOutputFile=#{compressed_path} #{original_path}
      CMD

      system(gs_command)

      if File.exist?(compressed_path) && File.size?(compressed_path)
        compressed_paths << compressed_path
      end
    end

    if compressed_paths.empty?
      render plain: "Compression failed", status: :internal_server_error
      return
    end

    document = Current.session.user.documents.create!(
      title: "Compressed PDFs - #{Time.current.strftime('%Y-%m-%d %H:%M:%S')}"
    )

    # Attach individual compressed files to `uploads`
    compressed_paths.each_with_index do |path, index|
      document.uploads.attach(
        io: File.open(path),
        filename: "compressed_#{index + 1}.pdf",
        content_type: "application/pdf"
      )
    end

    if compressed_paths.size == 1
      # Attach single file to `merged_pdf` as well
      document.file.attach(
        io: File.open(compressed_paths.first),
        filename: "compressed.pdf",
        content_type: "application/pdf"
      )

      send_file compressed_paths.first,
                filename: "compressed.pdf",
                type: "application/pdf",
                disposition: "attachment"
    else
      # Multiple files → create ZIP archive
      zip_path = Rails.root.join("tmp", "#{SecureRandom.hex}_compressed_files.zip")

      Zip::File.open(zip_path, Zip::File::CREATE) do |zipfile|
        compressed_paths.each_with_index do |path, index|
          zipfile.add("compressed_#{index + 1}.pdf", path)
        end
      end

      # Attach zip to `merged_pdf`
      document.file.attach(
        io: File.open(zip_path),
        filename: "compressed_pdfs.zip",
        content_type: "application/zip"
      )

      send_file zip_path,
                filename: "compressed_pdfs.zip",
                type: "application/zip",
                disposition: "attachment"
    end
  end
end
