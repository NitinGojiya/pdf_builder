class User < ApplicationRecord
  VALID_EMAIL_REGEX = /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/
  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :documents, dependent: :destroy
  # validation
  normalizes :email_address, with: ->(e) { e.strip.downcase }
  validates :email_address, presence: true
  validates :email_address, format: { with: VALID_EMAIL_REGEX, message: "is invalid" }
  validates :email_address, uniqueness: { case_sensitive: false }

  validates :password, presence: true
  validates :password, format: {
    with: /\A(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}\z/,
    message: "must be at least 8 characters long and include one uppercase letter, one lowercase letter, and one symbol"
  }
end
