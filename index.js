import express from 'express';
import bodyParser from "body-parser";
import pg from 'pg';
import Client from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';
const app = express();
const port = 3000;

//Middlewares:
app.use(express.static("public"));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static('assets'));

dotenv.config();

//DB configuration:
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DB,
  password: process.env.DB_PW,
  port: process.env.DB_PORT
});

db.connect();
let currentBookId = 0;

async function getBooks() {
  let books = [];
  let titles = [];
  //Retreive Column Records + Place into an Array.
  for (let i = 0; i < titles.length; i++) {
    books.push({
      id: titles.id[i],
      author: titles.author[i],
      isbn: titles.isbn[i],
      rating: titles.ratings[i],
      link: "https://covers.openlibrary.org/b/isbn/" + [i] + '-M.jpg' + `?default=false`
    })
  }
  return books;
}

//HOME PAGE:
app.get('/', async (req, res) => {
  let books = [];
  try {
    const result = await db.query('SELECT * FROM books');
    if (result.rows.length === 0) {
      res.render('add.ejs', {
        title: "Book Worm"
      })
    } else {
      let titles = result.rows; //TITLES
      titles.forEach((i) => {
        books.push({
          id: i.id,
          title: i.title,
          author: i.author,
          isbn: i.isbn,
          rating: i.rating,
          cover: "https://covers.openlibrary.org/b/isbn/" + i.isbn + '-M.jpg' + `?default=false`

        });
      });
      res.render('index.ejs', {
        title: "Book Worm",
        books,
        book: books
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.get('/add', async (req, res) => {
  res.render('add.ejs', {
    title: 'Book Worm',
    message: ''
  });
});

app.post('/info', async (req, res) => {
  const bookId = req.body.bookInfo;

  try {
    const result = await db.query('SELECT * FROM books WHERE id = ($1)', [bookId]);
    const book = {
      id: result.rows[0].id,
      title: result.rows[0].title =
        result.rows[0].title.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '),
      author: result.rows[0].author,
      isbn: result.rows[0].isbn,
      rating: result.rows[0].rating,
      notes: result.rows[0].notes,
      cover: `https://covers.openlibrary.org/b/isbn/` + result.rows[0].isbn + `-M.jpg` + `?default=false`
    };

    res.render('info.ejs', {
      title: "Book Worm",
      book
    });
  } catch (err) {
    console.log("Could not find book:", err);
  }
});

//CHECK if Book Exists
async function doesBookExist(addTitle) {
  try {
    const result = await db.query('SELECT 1 FROM books WHERE title ILIKE $1 LIMIT 1', [addTitle]);
    return result.rows.length > 0; // Returns true if a matching title is found
  } catch (err) {
    console.error("Error checking if book exists:", err);
    return false;
  }
}

// ADD NEW BOOK!
app.post('/add', async (req, res) => {
  const addTitle = req.body['newTitle']; // Parse New Title
  const addAuthor = req.body['newAuthor']; // Parse Author
  const addRating = req.body['newRating']; // Parse Rating
  const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(addTitle)}`);
  const data = await response.json();
  const book = data.docs[0];

  try {
    // CHECK if Book Exists
    const bookExists = await doesBookExist(addTitle);
    if (bookExists) {
      const message = "Book already exists!";
      return res.render('add.ejs', {
        title: 'Book Worm',
        message
      });
    }
    // If Book does NOT exist, Create Listing for NEW Book
    const newBook = {
      title: book.title || addTitle,
      author: book.author_name ? book.author_name.join(', ') : addAuthor,
      isbn: book.isbn ? book.isbn.shift() : 'N/A',
      rating: addRating
    };
    // Insert the new book entry into the database
    await db.query(
      'INSERT INTO books (title, author, isbn, rating) VALUES ($1, $2, $3, $4);',
      [newBook.title, newBook.author, newBook.isbn, newBook.rating]
    );

    const message = `"${newBook.title}" added successfully!`;
    res.render('add.ejs', {
      title: 'Book Worm',
      message
    });

  } catch (err) {
    console.error("Error adding book:", err); // Log the error for debugging
    res.render('add.ejs', {
      title: 'Book Worm',
      message: 'Error adding book!'
    });
  }
});


//EDIT PAGE
app.post('/edit', async (req, res) => {
  const bookId = req.body.bookEdit;
  const result = await db.query('SELECT * FROM books WHERE id= $1', [bookId]);
  const book = {
    id: result.rows[0].id,
    title: result.rows[0].title,
    author: result.rows[0].author,
    isbn: result.rows[0].isbn,
    rating: result.rows[0].rating,
    notes: result.rows[0].notes,
    cover: `https://covers.openlibrary.org/b/isbn/` + result.rows[0].isbn + `-M.jpg` + `?default=false`
  }
  res.render('edit.ejs', {
    title: 'Book Worm',
    book
  });
});

//UPDATE LISTING
app.post('/update', async (req, res) => {
  const bookId = req.body.bookId;
  const titleUpdate = req.body.updateTitle;
  const authorUpdate = req.body.updateAuthor;
  const ratingUpdate = req.body.updateRating;
  const isbnUpdate = req.body.updateIsbn;
  const notesUpdate = req.body.updateNotes;
  const book = {
    id: bookId,
    title: titleUpdate,
    author: authorUpdate,
    rating: ratingUpdate,
    isbn: isbnUpdate,
    notes: notesUpdate,
    cover: `https://covers.openlibrary.org/b/isbn/` + isbnUpdate + `-M.jpg` + `?default=false`
  }

  try {
    await db.query('UPDATE books SET title = $1, author = $2, rating= $3, isbn = $4, notes= $5 WHERE id = $6',
      [titleUpdate, authorUpdate, ratingUpdate, isbnUpdate, notesUpdate, bookId]);

    res.render('info.ejs', {
      title: "Book Worm",
      book
    });

  } catch (err) {
    console.log(err);

  }
});

app.post('/delete', async (req, res) => {
  const bookId = req.body.deleteBook;
  try {
    await db.query('DELETE FROM books WHERE id = $1', [bookId]);
    res.redirect('/');

  } catch (err) {
    console.log(err);
  }
});

//FOR SORTING ===== \\\|||
//Sort By Ascending Author
app.get('/authorASC', async (req, res) => {
  let books = [];
  try {
    const result = await db.query('SELECT * FROM books ORDER BY author ASC;');
    let titles = result.rows;
    titles.forEach((i) => {
      books.push({
        id: i.id,
        title: i.title,
        author: i.author,
        isbn: i.isbn,
        rating: i.rating,
        cover: `https://covers.openlibrary.org/b/isbn/` + i.isbn + `-M.jpg?default=false`
      });
    });
    res.render('index.ejs', {
      title: "Book Worm",
      books
    });
  } catch (err) {
    console.log(err);
  }
});

//Sort By Descending Author
app.get('/authorDESC', async (req, res) => {
  let books = [];
  try {
    const result = await db.query('SELECT * FROM books ORDER BY author DESC;');
    let titles = result.rows;
    titles.forEach((i) => {
      books.push({
        id: i.id,
        title: i.title,
        author: i.author,
        isbn: i.isbn,
        rating: i.rating,
        cover: `https://covers.openlibrary.org/b/isbn/` + i.isbn + `-M.jpg?default=false`
      });
    });
    res.render('index.ejs', {
      title: "Book Worm",
      books
    });
  } catch (err) {
    console.log(err)
  }
});

//Sort by Ascending Title:
app.get('/titleASC', async (req, res) => {
  let books = [];
  try {
    const result = await db.query('SELECT * FROM books ORDER by title ASC;');
    let titles = result.rows;
    titles.forEach((i) => {
      books.push({
        id: i.id,
        title: i.title,
        author: i.author,
        isbn: i.isbn,
        rating: i.rating,
        cover: `https://covers.openlibrary.org/b/isbn/` + i.isbn + `-M.jpg?default=false`
      });
    });
    res.render('index.ejs', {
      title: "Book Worm",
      books
    });
  } catch (err) {
    console.log(err);
  }
});

//Sort By Descending Title:
app.get('/titleDESC', async (req, res) => {
  let books = [];
  try {
    const result = await db.query('SELECT * FROM books ORDER BY title DESC;');
    let titles = result.rows;
    titles.forEach((i) => {
      books.push({
        id: i.id,
        title: i.title,
        author: i.author,
        isbn: i.isbn,
        rating: i.rating,
        cover: `https://covers.openlibrary.org/b/isbn/` + i.isbn + `-M.jpg?default=false`
      });
    });
    res.render('index.ejs', {
      title: "Book Worm",
      books
    });
  } catch (err) {
    console.log(err);

  }
});

//PORT LISTENER:
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// const API_key = process.env.apiKey;

//Cover Images:
// const API_URL = "https://openlibrary.org/isbn/";

//Author Images:
// const author = "https://covers.openlibrary.org";
// let authorImg = authorLink + `/a/${OLID}/${Value_Key}-${size}/?default=false`;
