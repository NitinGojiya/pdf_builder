Rails.application.routes.draw do
  root "home#index"

  resource :session
  resources :passwords, param: :token
  resources :users

  get "document_preview", to: "documents#document_preview", as: "document_preview"
  delete "file_destroy/:id", to: "documents#file_destroy", as: "file_destroy"
  # pdf merge routes
  get "pdf_merge", to: "documents#index", as: "pdf_merge"
  post "combine_pdfs", to: "documents#combine", as: "combine_pdfs"

  # pdf compress routes
  post "compress", to: "documents#compress", as: "compress"
  get "pdf_compress", to: "documents#pdf_compress", as: "pdf_compress"

  # pdf split routes
  get "pdf_split", to: "documents#pdf_split", as: "pdf_split"
  post "split", to: "documents#split", as: "split"

  # pdf to word routes
  get "pdf_word", controller: "conversions", as: "pdf_word"
  post "convert_pdf_to_word", to: "conversions#convert_pdf_to_word", as: "convert_pdf_to_word"

  # pdf to  powerpoint routes
  get "pdf_ppt", controller: "conversions", as: "pdf_ppt"
  post "convert_pdf_to_ppt", to: "conversions#convert_pdf_to_ppt", as: "convert_pdf_to_ppt"

  # pdf to  excel routes
  get "pdf_excel", controller: "conversions", as: "pdf_excel"
  post "convert_pdf_to_excel", to: "conversions#convert_pdf_to_excel", as: "convert_pdf_to_excel"

  # pdf to jpg routes
  get "pdf_jpg", controller: "conversions", as: "pdf_jpg"
  post "convert_pdf_to_jpg", to: "conversions#convert_pdf_to_jpg", as: "convert_pdf_to_jpg"

  # jpg to pdf routes
  get "jpg_pdf", controller: "conversions", as: "jpg_pdf"
  post "convert_jpg_to_pdf", to: "conversions#convert_jpg_to_pdf", as: "convert_jpg_to_pdf"

  # word to pdf routes
  get "word_pdf", controller: "conversions", as: "word_pdf"
  post "convert_word_to_pdf", to: "conversions#convert_word_to_pdf", as: "convert_word_to_pdf"

  # power point  to pdf routes
  get "ppt_pdf", controller: "conversions", as: "ppt_pdf"
  post "convert_ppt_to_pdf", to: "conversions#convert_ppt_to_pdf", as: "convert_ppt_to_pdf"

  # excel  to pdf routes
  get "excel_pdf", controller: "conversions", as: "excel_pdf"
  post "convert_excel_to_pdf", to: "conversions#convert_excel_to_pdf", as: "convert_excel_to_pdf"

  # html  to pdf routes
  get "html_pdf", controller: "conversions", as: "html_pdf"
  post "convert_html_to_pdf", to: "conversions#convert_html_to_pdf", as: "convert_html_to_pdf"

  # pdf unlock routes
  get "pdf_unlock", controller: "pdf_securities", as: "pdf_unlock"
  post "convert_pdf_unlock", to: "pdf_securities#convert_pdf_unlock", as: "convert_pdf_unlock"

  # pdf lock routes
  get "pdf_lock", controller: "pdf_securities", as: "pdf_lock"
  post "convert_pdf_lock", to: "pdf_securities#convert_pdf_lock", as: "convert_pdf_lock"

  # rotate pdf routes
  get "pdf_rotate", controller: "pdf_edits", as: "pdf_rotate"
  post "convert_pdf_rotate", to: "pdf_edits#convert_pdf_rotate", as: "convert_pdf_rotate"

  #  pdf edit routes
  get "pdf_edit", controller: "pdf_edits", as: "pdf_edit"
  post "convert_pdf_edit", to: "pdf_edits#convert_pdf_edit", as: "convert_pdf_edit"

  #  pdf crop routes
  get "pdf_crop", controller: "pdf_edits", as: "pdf_crop"
  post "convert_pdf_crop", to: "pdf_edits#convert_pdf_crop", as: "convert_pdf_crop"

  #  pdf watermark routes
  get "pdf_watermark", controller: "pdf_edits", as: "pdf_watermark"
  post "convert_pdf_watermark", to: "pdf_edits#convert_pdf_watermark", as: "convert_pdf_watermark"

  #  pdf sign routes
  get "pdf_sign", controller: "pdf_edits", as: "pdf_sign"
  post "convert_pdf_sign", to: "pdf_edits#convert_pdf_sign", as: "convert_pdf_sign"
end
