class Document < ApplicationRecord
  belongs_to :user

  has_many_attached :uploads, dependent: :destroy
  has_one_attached :file, dependent: :destroy
  validates :title, presence: true
end
