export const MAX_HOME_CAROUSEL_ITEMS = 8;

export interface HomeCarouselItem {
  id: string;
  image_url: string;
  storage_path: string;
  alt_text: string;
  link_url: string;
  is_active: boolean;
}
