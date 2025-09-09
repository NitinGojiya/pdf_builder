class UpdateSolidCacheEntriesForSolidCacheGem < ActiveRecord::Migration[8.0]
  def change
    add_column :solid_cache_entries, :key_hash, :string, null: false
    add_index :solid_cache_entries, :key_hash, unique: true
    remove_index :solid_cache_entries, :key
  end
end
