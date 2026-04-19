const mongoose = require('mongoose');

const deletedQueryFilter = function deletedQueryFilter() {
  const options = this.getOptions ? this.getOptions() : {};

  if (options.withDeleted) {
    return;
  }

  if (options.onlyDeleted) {
    this.where({ isDeleted: true });
    return;
  }

  this.where({ isDeleted: { $ne: true } });
};

const campaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    description: {
      type: String,
      required: [true, 'Campaign description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters']
    },
    goalAmount: {
      type: Number,
      required: [true, 'Goal amount is required'],
      min: [1, 'Goal amount must be at least 1']
    },
    raisedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Raised amount cannot be negative']
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused'],
      default: 'active'
    },
    coverImage: {
      type: String,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deletionReason: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

campaignSchema.index({ title: 'text', description: 'text' });
campaignSchema.index({ status: 1, createdAt: -1 });

campaignSchema.query.withDeleted = function withDeleted() {
  this.setOptions({ ...(this.getOptions ? this.getOptions() : {}), withDeleted: true });
  return this;
};

campaignSchema.query.onlyDeleted = function onlyDeleted() {
  this.setOptions({ ...(this.getOptions ? this.getOptions() : {}), withDeleted: true, onlyDeleted: true });
  return this;
};

campaignSchema.pre(/^find/, deletedQueryFilter);
campaignSchema.pre('countDocuments', deletedQueryFilter);

module.exports = mongoose.model('Campaign', campaignSchema);
