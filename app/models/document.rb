class Document < ApplicationRecord
  belongs_to :user

  has_many_attached :uploads
  has_one_attached :file
  validates :title, presence: true
end
