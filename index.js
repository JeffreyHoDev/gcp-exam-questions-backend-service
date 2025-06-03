const express = require('express')
const cors = require('cors');
var nodemailer = require('nodemailer');
const app = express()
const bcrypt = require('bcrypt');
const saltRounds = 10;

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

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL, // Use environment variable for security
    pass: process.env.EMAIL_PASSWORD, // Use environment variable for security
  }
});


app.use(cors({
  origin: ['http://localhost:3000' , 'https://gcp-exam-questions.vercel.app']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.post('/get_history_list', (req, res) => {
  const { identifier } = req.body;
  try {
    knex.raw(`SELECT * FROM login_identifier WHERE identifier='${identifier}'`)
    .then(response => {
      let user = response.rows[0];
      if (!user) {
        return res.status(404).json({ error: 'Identifier not found' });
      }else {
        knex.raw(`SELECT * FROM history WHERE identifier_id=${user.id} ORDER BY saved_time DESC`)
        .then(response => {
          res.json(response.rows);
        })
        .catch(err => {
          console.error('Error fetching history:', err);
          res.status(500).json({ error: err });
        })
      }
    })
    .catch(err => {
      console.error('Error checking identifier:', err);
      res.status(500).json({ error: err });
    })
  }catch(err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

app.post('/save_questions', (req, res) => {
  const { identifier, questions, scoreResult, password } = req.body;
  try {
    knex.raw(`SELECT * FROM login_identifier WHERE identifier='${identifier}'`)
    .then(response => {
      if(response.rows.length !== 0) {
        bcrypt.compare(password, response.rows[0].password).then(result => {
          if(result){
            let user = response.rows[0];
              knex.raw(
                `INSERT INTO history (identifier_id, questions, saved_time, score) VALUES (?, ?, NOW() AT TIME ZONE 'Asia/Singapore', ?)`,
                [user.id, JSON.stringify(questions), scoreResult]
              )
              .then(response => {
                res.json({ message: 'Questions saved successfully', details: response });
              })
              .catch(err => {
                console.error('Error saving questions:', err);
                res.status(500).json({ error: err });
              })
                       
          }else {
            res.status(401).json({error: 'Unauthorized access!'})
          }
        })


      }else {
        res.status(404).json({ error: 'Identifier not found' });
      }
    })
    .catch(err => {
      console.error('Error checking identifier:', err);
      res.json({ error: err });
    })
  }catch(err) {
    console.error('Error saving questions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }


})

app.post('/register_identifier', (req, res) => {
  try {
    const { identifier, registerEmail, password } = req.body;
    knex.raw(`SELECT * FROM login_identifier WHERE identifier='${identifier}'`)
    .then(response => {
      if(response.rows.length === 0){
        bcrypt.genSalt(saltRounds, function(err, salt) {
          bcrypt.hash(password, salt, function(err, hash) {
            knex.raw(
              `INSERT INTO login_identifier (identifier, email, created, password) VALUES (?, ?, NOW() AT TIME ZONE 'Asia/Singapore', ?) ON CONFLICT (identifier) DO NOTHING`,
              [identifier, registerEmail, hash]
            )
            .then(response => {
                if(registerEmail && registerEmail.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail)){
                  console.log('Sending email to:', registerEmail);
                  var mailOptions = {
                    from: process.env.EMAIL,
                    to: registerEmail,
                    subject: 'Identifer Registration Confirmation',
                    text: `Your registered identifier is ${identifier}.\nPlease keep this identifier safe as you will need it to log in and access your saved questions.`
                  };
        
                  transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                      console.log(error);
                    } else {
                      console.log('Email sent: ' + info.response);
                    }
                  });
                }
        
              res.json({ message: 'Identifier registered successfully', details: response });
            })
            .catch(err => {
              console.error('Error registering identifier:', err);
              res.status(500).json({ error: err });
            })
          });
        });
      }else {
        res.status(401).json({error: "Identifier already exist"})
      }
    })
  }catch(err) {
    console.error('Error registering identifier:', err);
    res.status(500).json({ error: err });
  }
})


app.post(`/login`, (req, res) => {
  const { identifier, password } = req.body;
  try {
    knex.raw(`SELECT * FROM login_identifier WHERE identifier='${identifier}'`)
    .then(response => {
      if (response.rows.length > 0) {
        bcrypt.compare(password, response.rows[0].password).then(result => {
          if(result){
            res.json({ message: 'Login successful', details: response.rows[0]});
          }else {
            res.status(401).json({error: 'Unauthorized access!'})
          }
        })
      }else {
        res.status(404).json({ error: 'Identifier not found' });
      }

        
    })
    .catch(err => {
      console.error('Error logging in:', err);
      res.status(500).json({ error: err });
    })
  }catch(err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: err });
  }
})


app.post('/historyDetails', (req, res) => {
  const { identifier, row_id } = req.body;
  try {
    knex.raw(`SELECT h.*
      FROM history h
      JOIN login_identifier u ON h.identifier_id=u.id
      WHERE u.identifier='${identifier}' AND h.id=${row_id}`)
    .then(response => {
      if (response.rows.length > 0) {
        res.json(response.rows[0]);
      } else {
        res.status(404).json({ error: 'History detail not found' });
      }
    })
    .catch(err => {
      console.error('Error fetching history detail:', err);
      res.status(500).json({ error: err });
    })
  }catch(err) {
    console.error('Error fetching history detail:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

app.listen(port, () => {
  console.log(`GCP-Exam Backend Service listening on port ${port}`)
})
