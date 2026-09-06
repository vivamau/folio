-- Existing creators are unknown; do not assign them to an arbitrary account.
ALTER TABLE Shops ADD COLUMN user_id INTEGER REFERENCES Users(ID);
ALTER TABLE ItemTypes ADD COLUMN user_id INTEGER REFERENCES Users(ID);
ALTER TABLE Items ADD COLUMN user_id INTEGER REFERENCES Users(ID);
ALTER TABLE Manufactures ADD COLUMN user_id INTEGER REFERENCES Users(ID);
