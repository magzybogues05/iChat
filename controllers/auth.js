const jwt=require('jsonwebtoken');
const User=require('../models/user');
const crypto=require('crypto');
const dotenv=require('dotenv');
const mailService= require('../services/mailer');
const otpGenerator=require('otp-generator');
const filterObj = require('../utils/filterObj');
const { promisify } = require('util');
dotenv.config();
const signToken= (userId)=> jwt.sign({userId},process.env.JWT_SECRET);

//Register New User
exports.register= async(req,res,next)=>{
    const {name,email,password}=req.body;
    
    const fileteredBody=filterObj(req.body,"name","password","email");
    //check if a verified user with given email exists
    const user=await User.findOne({email:email});

    if(user && user.verified)
    {
        res.status(400).json({
            status: "error",
            message:"email already exists. try another email",
        })
        return;
    }
    else if(user)
    {
        await User.findOneAndUpdate({email:email},fileteredBody,{new:true,validateModifiedOnly:true});

        //generate OTP and send email to user
        req.userId=user._id;
        next();
    }
    else{
        //user already not present
        const new_user=await User.create(fileteredBody);

        //generate OTP and send email to user
        req.userId=new_user._id;
        next();
    }
}

exports.sendOTP= async(req,res,next)=>{
    const {userId}=req;
    const new_otp= otpGenerator.generate(6, { 
        lowerCaseAlphabets:false,
        upperCaseAlphabets: false,
        specialChars: false,
    });
    
    //10 minute after the otp is generated.
    const otp_expiry_time = Date.now()+10*60*1000;

    await User.findByIdAndUpdate(userId,{
        otp:new_otp,
        otp_expiry_time,
    });

    //send email to user

    mailService.sendEmail({
        from: process.env.FALLBACK_EMAIL,
        to: process.env.TEMP_EMAIL,
        subject:"OTP from ichat",
        content:`<h1>Your OTP WILL BE COMMING SOOON</h1><h4>${new_otp} Valid for 10 minutes</h4>`
    }).then(()=>{
        res.status(200).json({
            status:"success",
            message:"OTP sent Successfully."
        })
    }).catch((err)=>{
        res.status(500).json({
            status:"error",
            message:"error sending OTP."
        })
    });

    
}

exports.verifyOTP= async(req,res,next)=>{
    //verify OTP and update user record accordingly

    const {email,otp}=req.body;
    const user=await User.findOne({
        email:email,
        otp_expiry_time:{$gt:Date.now()},
    });
    if(!user)
    {
        res.status(400).json({
            status:"error",
            message:"email invalid or otp expired",
        });
        return;
    }
    if(!(await user.matchOTP(otp,user.otp)))
    {
        res.status(400).json({
            status:"error",
            message:"OTP is incorrect",
        });
        return;
    }

    //correct otp
    user.verified=true;
    user.otp=undefined;
    await user.save({new:true,validateModifiedOnly:true});

    const token= signToken(user._id);

    res.status(200).json({
        status:"success",
        message:"OTP verified successfully",
        token,
    });
}

//login user
exports.login= async(req,res,next)=>{
    const {email,password}=req.body;
    if(!email || !password)
    {
        res.status(400).json({
            status:"error",
            message:"both email and password are required"
        });
        return;
    }
    const user=await User.findOne({email:email}).select("+password");
    if(!user || !(await user.matchPassword(password,user.password)))
    {
        res.status(400).json({
            status:"error",
            message:"Email or password is incorrect!"
        })
        return;
    }

    const token= signToken(user._id);

    res.status(200).json({
        status:"success",
        message:"Logged in successfully",
        token,
    });

}

//make sure that only login users are able to req api's
exports.protect= async(req,res,next)=>{

    //1. getting jwt token and check if it exists or not

    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith("Bearer"))
    {
        token=req.headers.authorization.split("")[1];

    }
    else if(req.cookies.jwt){
        token=req.cookies.jwt;
    }
    else{
        res.status(400).json({
            status:"error",
            message:"Please login to access",
        });
        return;
    }

    //2. verification of token
    const decoded =await promisify(jwt.verify)(token,process.env.JWT_SECRET);

    //3.check if user still exist

    const this_user=await User.findById(decoded.userId);
    if(!this_user)
    {
        res.status(400).json({
            status:"error",
            message:"User doesn't exist",
        });
        return;
    }

    //4. check if user changed their password after token was issued
    if(this_user.changedPasswordAfter(decoded.iat))
    {
        res.status(400).json({
            status:"error",
            message:"recently updated password, Please login again",
        });
        return;
    }
    req.user= this_user;
    next();
}

exports.forgotPassword = async(req,res,next)=>{

    //1. get user
    const {email}=req.body;
    const user=await User.findOne({email:email});
    if(!user){
        res.status(400).json({
            status:"error",
            message:"No user with given email exists"
        });
        return;
    }

    //2. generate the random reset token
    //https: // ?code=xydafjdjf

    const resetToken = user.createPasswordResetToken();

    const resetURL = `https://ichat.com/auth/reset-password/?code=${resetToken}`;
    try{
        //to be done : send email with reset url
        res.status(200).json({
            status:"success",
            message:"Reset password link sent to email",
        });

    }
    catch(error){
        user.passwordResetToken=undefined;
        user.passwordResetExpires=undefined;
        await user.save({validateBeforeSave:false});
        res.status(500).json({
            status:"error",
            message:"There was an error sending the email, please try again later",
        });
    }

}

exports.resetPassword= async(req,res,next)=>{

    //1. get the user based on token
    const hashedToken= crypto.createHash("sha256").update(req.params.token).digest("hex");
    const user= await User.findOne({
        passwordResetToken:hashedToken,
        passwordResetExpires:{$gt:Date.now()},
    });

    //2.token expired or invalid
    if(!user)
    {
        res.status(400).json({
            status:"error",
            message:"Token is Invalid or Expired",
        });
        return;
    }

    //3. updated users password
    user.password=req.body.password;

    user.passwordResetToken=undefined;
    user.passwordResetExpires=undefined;
    await user.save({validateBeforeSave:false});

    //4.login user and send new JWT token

    //todo- send user an email that password is updated. 

    const token= signToken(user._id);

    res.status(200).json({
        status:"success",
        message:"Password Reseted Successfully",
        token,
    });

}