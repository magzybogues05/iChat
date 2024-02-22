const express=require('express');
const morgan=require('morgan');
const rateLimit=require('express-rate-limit');
const helmet=require('helmet');
const mongosanitize= require("express-mongo-sanitize");
const bodyParser=require("body-parser");
const xss=require('xss');
// const {chats}= require('./data/data');
const dotenv=require('dotenv');
const cors = require('cors');

const http=require('http');
const { mongo } = require('mongoose');
const connectDB=require('./config/db');
// const userRoutes=require('./Routes/userRoutes');

const app=express();

//handling uncaughtexception
process.on("uncaughtException",(err)=>{
    console.log(err);
    process.exit(1);
});



const server=http.createServer(app);

app.use(express.urlencoded({
    extended:true,
}));
app.use(mongosanitize());
// app.use(xss());
app.use(express.json({limit:"10kb"}));
app.use(bodyParser.json());

app.use(helmet());

if(process.env.NODE_ENV ="development"){
    app.use(morgan("dev"));
}

const limiter=rateLimit({
    max:3000,
    windowMs:60*60*1000,
    message:"Rate Limit exceed..Try again after an hour"
});

app.use("/tawk",limiter);




app.use(cors({
    origin:"*",
    methods:["GET","POST","PATCH","DELETE","PUT"],
    credentials:true,
}));



dotenv.config();

// console.log(process.env.MONGO_URI);

connectDB();

// app.get('/',(req,res)=>{
//     res.send("api is running");
// })

// app.get('/api/chat',(req,res)=>{
//     res.send(chats);
// })

// app.get("/api/chat/:id",(req,res)=>{
//     // console.log(req.params.id);
//     const singleChat= chats.find((c)=>c._id===req.params.id);
//     console.log(singleChat);
//     res.send(singleChat);
// })

// app.use('/api/user',userRoutes);

const PORT=process.env.PORT || 5000;

server.listen(PORT,()=>{

    console.log(`server is running on port ${PORT}`);

})


//handling unhandledrejection
process.on("unhandledRejection",(err)=>{
    console.log(err);
    server.close(()=>{
        process.exit(1);
    });
});