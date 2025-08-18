SolidCable.configure do |config|
  config.connection_class = -> { ActiveRecord::Base.connection }
end