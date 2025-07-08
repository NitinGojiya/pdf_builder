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
  get "pdf_word", to: "conversions#pdf_word", as: "pdf_word"
  post "convert_pdf_to_word", to: "conversions#convert_pdf_to_word", as: "convert_pdf_to_word"

  # pdf to  powerpoint routes
  get "pdf_ppt", to: "conversions#pdf_ppt", as: "pdf_ppt"
  post "convert_pdf_to_ppt", to: "conversions#convert_pdf_to_ppt", as: "convert_pdf_to_ppt"
end
