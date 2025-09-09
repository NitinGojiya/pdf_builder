class AddKeyHashToSolidCacheEntries < ActiveRecord::Migration[8.0]
  def change
    add_column :solid_cache_entries, :key_hash, :string
  end
end
