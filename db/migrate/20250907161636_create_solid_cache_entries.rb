class CreateSolidCacheEntries < ActiveRecord::Migration[8.0]
  def change
    create_table :solid_cache_entries do |t|
      t.string :key, null: false
      t.jsonb :value
      t.timestamps
    end

    add_index :solid_cache_entries, :key, unique: true
  end
end
