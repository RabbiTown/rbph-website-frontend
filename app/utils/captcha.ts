export type CaptchaAction = 'login' | 'register';

export interface AuthCaptchaConfig {
  provider: 'cloudflare';
  site_key: string;
  login_required: boolean;
  registration_required: boolean;
}

export interface AuthPreflightConfig {
  captcha?: AuthCaptchaConfig | null;
}
