class Document < ApplicationRecord
  belongs_to :user

  has_many_attached :uploads
  has_one_attached :merged_pdf
  validates :title, presence: true
end
