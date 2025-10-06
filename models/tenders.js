const mongoose = require("mongoose");

const TendersSchema = new mongoose.Schema({
      
      title: {type:String, required:true},
      procurementOfficer: {type:mongoose.Schema.Types.ObjectId, ref: "User", required: true},
      company: {type:mongoose.Schema.Types.ObjectId, ref:"Company",required:true},
     

      deadline: {type:Date, required:true},
      description: {type:String, required:true},
      budget: {type:Number, required:true},
      urgency: {type:String, enum:["low","medium","high"], default:"medium"},
      location: {type:String, required:true},
 
      requisitionId: {type:mongoose.Schema.Types.ObjectId, ref:"Requisition", required:true},
      status: {type:String, enum:["open","closed","awarded"], default:"open"},
      requirements: { type: [String], default: [] }, 
     
      createdAt: { type: Date, default: Date.now },
       closedAt: {
    type: Date,
    default: null
  },
        awardedAt: {
        type: Date,         
        default: null

    },
      awardedTo: {type:mongoose.Schema.Types.ObjectId, ref:"Vendor", default:null},
      awardedAmount: {type:Number, default:0},
      awardedDocument: {type:String, default:""}, // URL or path to the document
      
      bids: [
            {
                vendor: {type:mongoose.Schema.Types.ObjectId, ref:"Vendor", },
                amount: {type:Number},
                proposalDocument: {type:String}, // URL or path to the document
                submittedAt: {type:Date, default:Date.now}
            }
        ]
}, { timestamps: true });

module.exports = mongoose.model("Tenders", TendersSchema);
