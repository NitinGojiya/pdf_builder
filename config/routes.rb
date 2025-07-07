Rails.application.routes.draw do
  root "home#index"

  resource :session
  resources :passwords, param: :token

  get "fileview", to: "documents#fileview", as: "fileview"

  get "pdf_merge", to: "documents#index", as: "pdf_merge"
  post "combine_pdfs", to: "documents#combine", as: "combine_pdfs"

  post "compress", to: "documents#compress", as: "compress"
  get "pdf_compress", to: "documents#pdf_compress", as: "pdf_compress"
end
