const dotenv=require('dotenv')
const sgMail= require("@sendgrid/mail");

dotenv.config();
sgMail.setApiKey(process.env.SG_KEY);

const sendSGMail= async({
    recipient,
    sender,
    subject,
    content,
    attachments,
})=>{
    try{
        const from =sender || process.env.FALLBACK_EMAIL;

        const msg={
            to:recipient, //reciever email
            from:from,    //verified sender
            subject,
            html:content,
            // text:""
            attachments,
        }
        return sgMail.send(msg); //.send method returns a promise
    }
    catch(error)
    {
        console.log(error);
    }
};


//just to make sure that users don't get mail while development or testing
exports.sendEmail = async(args)=>{
    if(process.env.NODE_ENV==="development"){
        return new Promise.resolve();
    }
    else{
        return sendSGMail(args);
    }
};