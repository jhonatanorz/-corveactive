-- Per-color product images. color IS NULL = the product's default image;
-- color = a variants.color value = that color's image. One-per-color is kept at the
-- app layer (replace-on-upload), so no constraint that could fail on existing rows.
alter table product_images add column color text;
