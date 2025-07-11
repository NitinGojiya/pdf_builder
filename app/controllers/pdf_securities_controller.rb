require "hexapdf"

class PdfSecuritiesController < ApplicationController
  def convert_pdf_unlock
    uploaded_io = params[:files].first
    password = params[:password]

    input_path = Rails.root.join("tmp", uploaded_io.original_filename)
    File.open(input_path, "wb") do |file|
      file.write(uploaded_io.read)
    end

    output_filename = "unlocked_#{uploaded_io.original_filename}"
    output_path = Rails.root.join("tmp", output_filename)

    success = system("qpdf --password='#{password}' --decrypt '#{input_path}' '#{output_path}'")

    if success && File.exist?(output_path)
        document = Current.session.user.documents.create!(
        title: "Unlock PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
      )
      document.uploads.attach(uploaded_io)
      document.file.attach(
          io: File.open(output_path),
          filename: output_filename,
          content_type: "application/pdf"
        )
      send_file output_path, filename: output_filename, type: "application/pdf"
    else
      render json: { error: "Failed to unlock PDF. Check the password or file." }, status: :unprocessable_entity
    end
  end

  def convert_pdf_lock
    uploaded_io = params[:files].first
    password = params[:password]

    input_path = Rails.root.join("tmp", uploaded_io.original_filename)
    File.open(input_path, "wb") do |file|
      file.write(uploaded_io.read)
    end

    output_filename = "locked_#{uploaded_io.original_filename}"
    output_path = Rails.root.join("tmp", output_filename)

    # qpdf encryption: --encrypt user-password owner-password key-length -- input output
    # We're using the same password for both user and owner here; adjust as needed
    success = system("qpdf --encrypt '#{password}' '#{password}' 256 -- '#{input_path}' '#{output_path}'")

    if success && File.exist?(output_path)
      document = Current.session.user.documents.create!(
        title: "Lock PDF - #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
      )
      document.uploads.attach(uploaded_io)
      document.file.attach(
        io: File.open(output_path),
        filename: output_filename,
        content_type: "application/pdf"
      )
      send_file output_path, filename: output_filename, type: "application/pdf"
    else
      render json: { error: "Failed to lock PDF. Please try again." }, status: :unprocessable_entity
    end
  end
end
