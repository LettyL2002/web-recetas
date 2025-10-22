/*
  # Cupcake Recipe Application Schema
  
  1. New Tables
    - `recipes`
      - `id` (uuid, primary key) - Unique identifier for each recipe
      - `user_id` (uuid) - Reference to the user who created the recipe
      - `name` (text) - Name of the cupcake recipe
      - `description` (text) - Short description of the recipe
      - `ingredients` (text) - List of ingredients needed
      - `instructions` (text) - Step-by-step cooking instructions
      - `image_url` (text) - URL to the cupcake image
      - `created_at` (timestamptz) - Timestamp of recipe creation
      - `updated_at` (timestamptz) - Timestamp of last update
  
  2. Security
    - Enable RLS on `recipes` table
    - Add policy for authenticated users to view all recipes
    - Add policy for authenticated users to insert their own recipes
    - Add policy for authenticated users to update their own recipes
    - Add policy for authenticated users to delete their own recipes
  
  3. Important Notes
    - All users can view all recipes (public reading)
    - Users can only modify/delete recipes they created
    - Image URLs will be stored as text (can link to external images or Pexels)
*/

-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  ingredients text NOT NULL,
  instructions text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view all recipes
CREATE POLICY "Anyone can view recipes"
  ON recipes FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert their own recipes
CREATE POLICY "Users can create their own recipes"
  ON recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own recipes
CREATE POLICY "Users can update their own recipes"
  ON recipes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own recipes
CREATE POLICY "Users can delete their own recipes"
  ON recipes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS recipes_user_id_idx ON recipes(user_id);
CREATE INDEX IF NOT EXISTS recipes_created_at_idx ON recipes(created_at DESC);