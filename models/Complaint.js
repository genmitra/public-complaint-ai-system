const mongoose = require('mongoose');
const { Schema } = mongoose;

// Complaint Schema for the AI-powered public complaint system
const ComplaintSchema = new Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Complaint title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be longer than 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Complaint description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot be longer than 5000 characters']
  },
  
  // Complainant Information
  complainant: {
    name: {
      type: String,
      required: [true, 'Complainant name is required'],
      trim: true,
      maxlength: [100, 'Name cannot be longer than 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number']
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'United States'
      }
    }
  },
  
  // Complaint Classification
  category: {
    type: String,
    required: [true, 'Complaint category is required'],
    enum: {
      values: [
        'Public Safety',
        'Infrastructure',
        'Transportation',
        'Environmental',
        'Public Health',
        'Government Services',
        'Education',
        'Housing',
        'Consumer Rights',
        'Discrimination',
        'Corruption',
        'Other'
      ],
      message: '{VALUE} is not a valid category'
    }
  },
  
  subcategory: {
    type: String,
    trim: true,
    maxlength: [100, 'Subcategory cannot be longer than 100 characters']
  },
  
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  
  // AI Analysis Results
  aiAnalysis: {
    sentiment: {
      score: {
        type: Number,
        min: -1,
        max: 1
      },
      label: {
        type: String,
        enum: ['positive', 'negative', 'neutral']
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1
      }
    },
    
    urgencyScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 5
    },
    
    suggestedCategory: String,
    
    keyPhrases: [String],
    
    suggestedResponse: {
      type: String,
      maxlength: [2000, 'Suggested response cannot be longer than 2000 characters']
    }
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: {
      values: [
        'submitted',
        'received',
        'under_review',
        'investigating',
        'pending_response',
        'resolved',
        'closed',
        'escalated'
      ],
      message: '{VALUE} is not a valid status'
    },
    default: 'submitted'
  },
  
  // Assignment and Handling
  assignedTo: {
    department: String,
    officer: String,
    email: String
  },
  
  // Tracking and Communication
  ticketId: {
    type: String,
    unique: true,
    required: true
  },
  
  updates: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: String,
    message: String,
    updatedBy: {
      name: String,
      role: String,
      email: String
    },
    internal: {
      type: Boolean,
      default: false
    }
  }],
  
  // Attachments and Evidence
  attachments: [{
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    url: String
  }],
  
  // Location Information
  location: {
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    landmark: String
  },
  
  // Resolution and Feedback
  resolution: {
    summary: String,
    actions_taken: [String],
    resolved_date: Date,
    resolved_by: {
      name: String,
      department: String,
      email: String
    }
  },
  
  feedback: {
    satisfaction_rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    submitted_date: Date
  },
  
  // GitHub Integration
  github: {
    issue_number: Number,
    issue_url: String,
    labels: [String]
  },
  
  // Metadata
  isPublic: {
    type: Boolean,
    default: true
  },
  
  isAnonymous: {
    type: Boolean,
    default: false
  },
  
  tags: [String],
  
  relatedComplaints: [{
    type: Schema.Types.ObjectId,
    ref: 'Complaint'
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
ComplaintSchema.index({ ticketId: 1 }, { unique: true });
ComplaintSchema.index({ 'complainant.email': 1 });
ComplaintSchema.index({ category: 1, status: 1 });
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ priority: 1, status: 1 });
ComplaintSchema.index({ 'aiAnalysis.urgencyScore': -1 });

// Virtual for complaint age in days
ComplaintSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for full address
ComplaintSchema.virtual('complainant.fullAddress').get(function() {
  const addr = this.complainant.address;
  if (!addr) return '';
  
  return [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
    .filter(Boolean)
    .join(', ');
});

// Pre-save middleware to generate ticket ID
ComplaintSchema.pre('save', function(next) {
  if (!this.ticketId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.ticketId = `COMP-${timestamp}-${random}`;
  }
  next();
});

// Method to add status update
ComplaintSchema.methods.addUpdate = function(status, message, updatedBy, isInternal = false) {
  this.updates.push({
    status,
    message,
    updatedBy,
    internal: isInternal,
    timestamp: new Date()
  });
  
  if (status) {
    this.status = status;
  }
  
  return this.save();
};

// Method to calculate priority based on AI analysis
ComplaintSchema.methods.calculatePriority = function() {
  const urgencyScore = this.aiAnalysis.urgencyScore || 5;
  const sentimentScore = this.aiAnalysis.sentiment.score || 0;
  
  // Higher urgency and negative sentiment increase priority
  if (urgencyScore >= 8 || (urgencyScore >= 6 && sentimentScore <= -0.5)) {
    this.priority = 'Critical';
  } else if (urgencyScore >= 6 || (urgencyScore >= 4 && sentimentScore <= -0.3)) {
    this.priority = 'High';
  } else if (urgencyScore >= 3) {
    this.priority = 'Medium';
  } else {
    this.priority = 'Low';
  }
  
  return this.priority;
};

// Static method to get complaints by status
ComplaintSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Static method to get urgent complaints
ComplaintSchema.statics.getUrgentComplaints = function() {
  return this.find({
    $or: [
      { priority: { $in: ['Critical', 'High'] } },
      { 'aiAnalysis.urgencyScore': { $gte: 7 } }
    ],
    status: { $nin: ['resolved', 'closed'] }
  }).sort({ 'aiAnalysis.urgencyScore': -1, createdAt: -1 });
};

module.exports = mongoose.model('Complaint', ComplaintSchema);
