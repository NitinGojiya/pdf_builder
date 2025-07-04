class DocumentsController < ApplicationController
  def index
  end

  def combine
    uploaded_files = params[:files] # this will be an array of ActionDispatch::Http::UploadedFile
    # You can use CombinePDF or HexaPDF here to merge
    merged_pdf = CombinePDF.new
    uploaded_files.each do |file|
      merged_pdf << CombinePDF.parse(file.read)
    end

    send_data merged_pdf.to_pdf,
              filename: "merged.pdf",
              type: "application/pdf",
              disposition: "attachment"
  end
end
