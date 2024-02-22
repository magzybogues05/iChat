const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const crypto=require('crypto');
const userSchema=mongoose.Schema({

    name:{
        type:String,
        required:[true,"Name is required"],
    },
    email:{
        type:String,
        required:[true,"email is required"],
        unique:true,
        validate:{
            validator: function(email){
                return String(email)
                .toLowerCase()
                .match(
                    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
                );
            },
            message:(props)=>`Email {${props.value}} is invalid!`,
        },
    },
    password:{
        type:String,
        required:true,
    },
    avatar:{
        type:String,
        default: "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },
    passwordChangedAt:{
        type:Date,
    },
    passwordResetToken:{
        type:String,
    },
    passwordResetExpires:{
        type:Date,
    },
    createdAt:{
        type:Date,
    },
    updatedAt:{
        type:Date,
    },
    verified:{
        type:Boolean,
        default:false,
    },
    otp:{
        type:Number,
    },
    otp_expiry_time:{
        type:Date,
    },

});

userSchema.methods.matchPassword= async function(enteredPassword,userPassword){
    return await bcrypt.compare(enteredPassword,userPassword);
}

userSchema.methods.matchOTP= async function(enteredOTP,userOTP){
    return await bcrypt.compare(enteredOTP,userOTP);
}

// creating hook that acts as middleware before save operation
userSchema.pre('save',async function(next){
    if(!this.isModified("otp")){
       return next();
    }
    const salt=await bcrypt.genSalt(12);
    this.otp= await bcrypt.hash(this.otp,salt);
    next();
});


userSchema.methods.createPasswordResetToken= function(){

    const resetToken= crypto.randomBytes(32).toString("hex");
    this.passwordResetToken=crypto.createHash("sha256").update(resetToken).digest("hex");
    this.passwordResetExpires=Date.now()+10*60*1000;
    return resetToken;
}

const User=mongoose.model("User",userSchema);

module.exports=User;