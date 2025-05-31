const express = require('express')
const cors = require('cors');

const app = express()

require('dotenv').config()
const port = process.env.PORT || 8000

const knex = require('knex')({
  client: 'pg',
  version: '7.2',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB,
  },
});


app.use(cors({
  origin: ['http://localhost:3000' , 'https://gcp-exam-questions.vercel.app']
}));


app.get('/', (req, res) => {

  try {
    let random1 = Math.floor(Math.random() * 6) + 1
    let random2;
  
    do {
      random2 = Math.floor(Math.random() * 6) + 1;
    } while (random1 === random2);
      knex.raw(`(SELECT * FROM questions WHERE id BETWEEN 1 AND 199 ORDER BY RANDOM() LIMIT 50) UNION ALL (SELECT * FROM questions WHERE type='case${random1}' ORDER BY RANDOM() LIMIT 5) UNION ALL (SELECT * FROM questions WHERE type='case${random2}' ORDER BY RANDOM() LIMIT 5) ORDER BY id`)
      .then(response => {
          let data = response.rows.map(row => {
              let length = row["options"].length
              let choices = []
              for(let i = 0; i < length; i++){
                  choices.push(false)
              }
              row["choices"] = choices
              return row
          })
          res.json(data)
          
      })
  }catch(err){
    res.error('err:', err)
  } 

})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
