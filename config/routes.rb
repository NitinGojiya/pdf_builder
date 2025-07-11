Rails.application.routes.draw do
  root "home#index"

  resource :session
  resources :passwords, param: :token

  get "fileview", to: "documents#fileview", as: "fileview"
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

  # pdf unlock routes
  get "pdf_unlock", controller: "pdf_securities", as: "pdf_unlock"
  post "convert_pdf_unlock", to: "pdf_securities#convert_pdf_unlock", as: "convert_pdf_unlock"
end
