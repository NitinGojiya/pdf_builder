Rails.application.routes.draw do
  root "home#index"

  resource :session
  resources :passwords, param: :token

  get "documents", to: "documents#index", as: "document"
end
