const jwt=require('jsonwebtoken');
const User=require('../models/user');
const otpGenerator=require('otp-generator');
const filterObj = require('../utils/filterObj');

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
    // to be continued...

    res.status(200).json({
        status:"success",
        message:"OTP sent Successfully."
    })
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
    }
    if(!(await user.matchOTP(otp,user.otp)))
    {
        res.status(400).json({
            status:"error",
            message:"OTP is incorrect",
        });
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
    }
    const user=await User.findOne({email:email}).select("+password");
    if(!user || !(await user.matchPassword(password,user.password)))
    {
        res.status(400).json({
            status:"error",
            message:"Email or password is incorrect!"
        })
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
        })

    }
    catch(error){
        user.passwordResetToken=undefined;
        user.passwordRe
    }


}

exports.resetPassword= async(req,res,next)=>{

}