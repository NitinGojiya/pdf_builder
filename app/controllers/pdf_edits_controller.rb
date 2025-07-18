require "combine_pdf"
require "zip"
require "mini_magick"
require 'prawn'
require 'prawn/templates'
# Controller for handling PDF editing operations such as rotation, cropping, and general edits.
#
# Actions:
# - convert_pdf_rotate: Rotates each uploaded PDF file by a specified degree and returns a ZIP archive of the rotated PDFs.
#   Params:
#     - files: Array of uploaded PDF files.
#     - rotations: Array of rotation degrees corresponding to each file.
#   Responses:
#     - Returns a ZIP file containing the rotated PDFs as an attachment.
#     - Returns error if files or rotations are missing or mismatched.
#
# - convert_pdf_edit: Handles editing of a PDF file and returns the edited PDF.
#   Params:
#     - file: The edited PDF file.
#     - original_file: The original PDF file (for record keeping).
#   Responses:
#     - Returns the edited PDF inline.
#     - Returns error if no file is uploaded.
#
# - convert_pdf_crop: Handles cropping of a PDF file and returns the cropped PDF.
#   Params:
#     - cropped_pdf: The cropped PDF file.
#     - original_pdf: The original PDF file (for record keeping).
#   Responses:
#     - Returns the cropped PDF as an attachment.
#     - Returns error if no cropped file is received.
#
# All actions create a Document record associated with the current user session and attach relevant files for audit and retrieval.
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
    original_file = params[:original_file]
    unless file
      render json: { error: "No file uploaded" }, status: :bad_request and return
    end

    document = Current.session.user.documents.create!(
      title: "Edited PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
    )
    document.uploads.attach(original_file)
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

  def convert_pdf_crop
    file = params[:cropped_pdf]
    original_pdf = params[:original_pdf]

    document = Current.session.user.documents.create!(
      title: "Crop PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
    )
    document.uploads.attach(original_pdf) if original_pdf.present?

    if file.present?
      temp = Tempfile.new(["client_cropped", ".pdf"], binmode: true)
      temp.write(file.read)
      temp.rewind

      document.file.attach(
        io: temp,
        filename: "cropped_pdf.pdf",
        content_type: "application/pdf"
      )

      temp.rewind  #  reading from the beginning

      send_data temp.read,
                filename: "cropped_pdf.pdf",
                type: "application/pdf",
                disposition: "attachment"

      temp.close
      temp.unlink
    else
      render json: { error: "No file received" }, status: :unprocessable_entity
    end
  end

  FONT_MAP = {
    "arial" => "Helvetica",
    "helvetica" => "Helvetica",
    "times" => "Times-Roman",
    "times-new-roman" => "Times-Roman",
    "courier" => "Courier"
  }

  POSITION_MAP = {
    "top-left" =>       { align: :left,   x: 40, y: ->(pdf) { pdf.bounds.top - 40 } },
    "top-center" =>     { align: :center, x: ->(pdf) { pdf.bounds.width / 2 - 100 }, y: ->(pdf) { pdf.bounds.top - 40 } },
    "top-right" =>      { align: :right,  x: ->(pdf) { pdf.bounds.right - 200 }, y: ->(pdf) { pdf.bounds.top - 40 } },
    "middle-left" =>    { align: :left,   x: 40, y: ->(pdf) { pdf.bounds.height / 2 } },
    "center" =>         { align: :center, x: ->(pdf) { pdf.bounds.width / 2 - 100 }, y: ->(pdf) { pdf.bounds.height / 2 } },
    "middle-right" =>   { align: :right,  x: ->(pdf) { pdf.bounds.right - 200 }, y: ->(pdf) { pdf.bounds.height / 2 } },
    "bottom-left" =>    { align: :left,   x: 40, y: ->(pdf) { 40 } },
    "bottom-center" =>  { align: :center, x: ->(pdf) { pdf.bounds.width / 2 - 100 }, y: ->(pdf) { 40 } },
    "bottom-right" =>   { align: :right,  x: ->(pdf) { pdf.bounds.right - 200 }, y: ->(pdf) { 40 } }
  }

  def convert_pdf_watermark
    file = params[:files].first.tempfile
    text = params[:text] || "WATERMARK"
    user_font = (params[:font] || "Helvetica").downcase
    font = FONT_MAP[user_font] || "Helvetica"
    font_size = params[:fontSize].to_i > 0 ? params[:fontSize].to_i : 12
    color = params[:color] || "#000000"
    bold = ActiveModel::Type::Boolean.new.cast(params[:bold])
    italic = ActiveModel::Type::Boolean.new.cast(params[:italic])
    underline = ActiveModel::Type::Boolean.new.cast(params[:underline])
    position_key = params[:position] || "center"
    position = POSITION_MAP[position_key] || POSITION_MAP["center"]

    original_pdf = CombinePDF.load(file.path)
    watermarked_pdf = CombinePDF.new

    original_pdf.pages.each_with_index do |_, index|
      watermark_tempfile = Tempfile.new(["watermark_page", ".pdf"])

      Prawn::Document.generate(watermark_tempfile.path, page_size: 'A4') do |pdf|
        pdf.font font
        pdf.fill_color color.delete('#')

        style = if bold && italic
                  :bold_italic
                elsif bold
                  :bold
                elsif italic
                  :italic
                else
                  :normal
                end

        x = position[:x].is_a?(Proc) ? position[:x].call(pdf) : position[:x]
        y = position[:y].call(pdf)
        box_width = 200

        pdf.text_box text,
          at: [x, y],
          width: box_width,
          align: position[:align],
          size: font_size,
          style: style

        if underline
          underline_y = y - 2
          pdf.stroke_color color.delete('#')
          pdf.stroke_line [x, underline_y], [x + box_width, underline_y]
        end
      end

      watermark_pdf = CombinePDF.load(watermark_tempfile.path)
      page_with_watermark = original_pdf.pages[index]
      page_with_watermark << watermark_pdf.pages[0]

      watermarked_pdf << page_with_watermark
      watermark_tempfile.close
      watermark_tempfile.unlink
    end

    output_pdf = Tempfile.new(["final", ".pdf"])
    watermarked_pdf.save output_pdf.path

    # Create document record and attach files
    document = Current.session.user.documents.create!(
      title: "Watermark PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
    )

    # Attach the original file (ensure it's rewound first)
    file.rewind
    document.uploads.attach(io: file, filename: params[:files].first.original_filename, content_type: "application/pdf")

    # Attach the watermarked PDF as the 'final' file
    document.file.attach(
      io: File.open(output_pdf.path),
      filename: "watermarked.pdf",
      content_type: "application/pdf"
    )

    send_file output_pdf.path, filename: "watermarked.pdf", type: "application/pdf"
  end
end
