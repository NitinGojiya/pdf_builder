class SessionsController < ApplicationController
  allow_unauthenticated_access only: %i[ new create omniauth]
  rate_limit to: 10, within: 3.minutes, only: :create, with: -> { redirect_to new_session_url, alert: "Try again later." }

  def new
  end

  def create
    if user = User.authenticate_by(user_params)
      start_new_session_for user
      redirect_to after_authentication_url, notice: "Welcome back, #{user.email_address}!"
    else
      redirect_to new_session_path, alert: "Try another email address or password."
    end
  end
  def omniauth
    auth = request.env['omniauth.auth']
    email = auth.info.email

    user = User.find_by(email_address: email)

    if user.nil?
      # Create user with random password, skipping validations if needed
      user = User.new(email_address: email)
      password = strong_random_password
      user.password = password
      user.password_confirmation = password

      if user.save
        start_new_session_for user
        redirect_to after_authentication_url, notice: "Signed up with Google as #{user.email_address}"
      else
        redirect_to new_user_path, alert: "Google sign-up failed: #{user.errors.full_messages.to_sentence}"
      end
    else
      start_new_session_for(user)
      redirect_to after_authentication_url, notice: "Signed in with Google as #{user.email_address}"
    end
  rescue => e
    Rails.logger.error("Google auth failed: #{e.message}")
    redirect_to new_session_path, alert: "Google login failed. Try again."
  end

  def destroy
    terminate_session
    redirect_to root_path, notice: "You have been logged out."
  end
  private
    def user_params
      params.permit(:email_address, :password)
    end
    def strong_random_password(length = 12)
      lowercase = ('a'..'z').to_a.sample
      uppercase = ('A'..'Z').to_a.sample
      symbol    = ['!', '@', '#', '$', '%', '^', '&', '*'].sample
      others    = Array.new(length - 3) { [('a'..'z'), ('A'..'Z'), ('0'..'9'), ['!', '@', '#', '$', '%', '^', '&', '*']].flat_map(&:to_a).sample }

      (others + [lowercase, uppercase, symbol]).shuffle.join
    end
end
