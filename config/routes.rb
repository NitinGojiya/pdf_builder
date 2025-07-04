Rails.application.routes.draw do
  root "home#index"

  resource :session
  resources :passwords, param: :token

  get "pdf_merge", to: "documents#index", as: "pdf_merge"
  post "combine_pdfs", to: "documents#combine", as: "combine_pdfs"

  get "pdf_compress", to: "documents#compress", as: "pdf_compress"
end
