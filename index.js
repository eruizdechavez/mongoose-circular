// Dependencies
var mongoose = require('mongoose'),
	async = require('async');

// Connect to Mongoose
mongoose.connect('mongodb://localhost:27017/circular');

var Schema = mongoose.Schema,
	ObjectId = Schema.Types.ObjectId;

// Schema definitions
var PostSchema = new Schema({
	title: {
		type: String,
		'default': ''
	},
	content: {
		type: String,
		'default': ''
	}
});
var AttachmentSchema = new Schema({
	fileName: {
		type: String,
		'default': ''
	}
});

// Circular reference definitions
PostSchema.add({
	attachments: [{
		type: ObjectId,
		ref: 'Attachment'
	}]
});
AttachmentSchema.add({
	posts: [{
		type: ObjectId,
		ref: 'Post'
	}]
});

// A couple of methods to save references inside the documents by using only
// the _id instead of creating a subdocument.
PostSchema.methods.attach = function(attachment, callback) {
	this.attachments.push(attachment)
	return this.save(callback);
}
AttachmentSchema.methods.share = function(post, callback) {
	this.posts.push(post)
	return this.save(callback);
}

// Models definition
var Post = mongoose.model('Post', PostSchema, 'posts');
var Attachment = mongoose.model('Attachment', AttachmentSchema, 'attachments');

var p, a;

// Go parallel!
async.parallel({
	post: function(callback) {
		console.log('creating a post');
		p = new Post({
			title: 'Test post (' + Date.now() + ')',
			content: 'Test post (' + Date.now() + ')'
		});
		p.save(callback);
	},
	attachment: function(callback) {
		console.log('creating an attachment');
		a = new Attachment({
			fileName: 'test_' + Date.now() + '.txt'
		});
		a.save(callback);
	}
}, function(err, res) {
	// Once we have a new post and a new attachment, create a relation on each one,
	// this is only a demo of having the reference of each other but it is not required.

	// Go parallel (one more time :D)!
	async.parallel({
		attach: function(callback) {
			console.log('attaching to a post');
			p.attach(a, callback);
		},
		share: function(callback) {
			console.log('sharing an attachment');
			a.share(p, callback);
		}
	}, function(err, res) {
		// Dump the current data, just to see if it is working ;)
		Post.find().populate('attachments').exec(function(err, posts) {
			if (err) {
				mongoose.disconnect();
				return console.log(':(');
			}

			posts.forEach(function(post){
				console.log('Post ' + post.title + ' has ' + post.attachments.length + ' attachment(s):');
				post.attachments.forEach(function(attachment) {
					console.log('- Filename: ' + attachment.fileName);
				});
			});

			mongoose.disconnect();
		});
	});
});
