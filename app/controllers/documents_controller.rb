class DocumentsController < ApplicationController
  def index
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
    document.merged_pdf.attach(
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

  def compress
  end
end
