require "combine_pdf"
require "zip"
class PdfEditsController < ApplicationController
  def convert_pdf_rotate
    uploaded_files = params[:files]
    rotations = params[:rotations]

    if uploaded_files.blank? || rotations.blank?
      render plain: "Missing files or rotations", status: :bad_request and return
    end

    unless uploaded_files.size == rotations.size
      render plain: "Mismatched files and rotation counts", status: :bad_request and return
    end

    document = Current.session.user.documents.create!(
          title: "Rotate PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
        )

    zip_path = Rails.root.join("tmp", "rotated_pdfs_#{Time.now.to_i}.zip")

    Zip::File.open(zip_path, Zip::File::CREATE) do |zipfile|
      uploaded_files.each_with_index do |uploaded_file, index|
        rotation = rotations[index].to_i
        filename = uploaded_file.original_filename.presence || "rotated_#{index + 1}.pdf"
        document.uploads.attach(uploaded_file)
        next unless uploaded_file.content_type == "application/pdf"

        temp_pdf = Tempfile.new([ "processed_#{index}", ".pdf" ])

        if rotation % 360 == 0
          # Just copy the original file to temp location
          FileUtils.cp(uploaded_file.tempfile.path, temp_pdf.path)
        else
          # Rotate using CombinePDF
          pdf = CombinePDF.load(uploaded_file.tempfile.path)
          pdf.pages.each { |page| page[:Rotate] = ((page[:Rotate] || 0) + rotation) % 360 }
          pdf.save(temp_pdf.path)
        end

        # Add to zip
        zipfile.add(filename, temp_pdf.path)

        temp_pdf.close
      end
    end
      document.file.attach(
          io: File.open(zip_path),
          filename: "rotated_pdfs",
          content_type: "application/zip"
        )
    send_file zip_path, filename: "rotated_pdfs.zip", type: "application/zip", disposition: "attachment"
  end


  def convert_pdf_edit
    file = params[:file]

    unless file
      render json: { error: "No file uploaded" }, status: :bad_request and return
    end

    document = Current.session.user.documents.create!(
      title: "Edited PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
    )

    document.file.attach(
      io: file.tempfile,
      filename: "edited_pdf.pdf",
      content_type: file.content_type || "application/pdf"
    )

    send_data document.file.download,
              filename: document.file.filename.to_s,
              type: document.file.content_type,
              disposition: "inline"
  end
end
