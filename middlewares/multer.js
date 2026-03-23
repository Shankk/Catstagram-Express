const multer = require('multer');
const path = require('path');
const mime = require('mime-types');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req,file,cb) => {
        const folderName = req.body.folder; // fallback to root

        console.log('req.body:', req.body);
        console.log('req.body.folder:', req.body.folder);

        if(!folderName || folderName.includes('/') || folderName.includes('\\')) {
            return cb(new Error('Invalid folder name'));
        }

        const uploadPath = path.join(__dirname, '..', 'uploads', folderName);

        if(!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, {recursive: true});
        }

        cb(null, uploadPath);
    },
    filename: (req,file,cb) => {
        //const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        //cb(null, uniqueSuffix + path.extname(file.originalname));
        const ext = mime.extension(file.mimetype); // e.g '.pdf'
        const baseName = path.basename(file.originalname, path.extname(file.originalname)); // e.g. 'report'
        const finalName =  ext ? `${baseName}.${ext}` : baseName;
        cb(null, finalName);
        //cb(null, file.originalname); // Uses the orginal name of the file.
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if(!ext) {
        return cb(new Error('File must have an extension'), false);
    }
    cb(null, true);
}

const upload = multer({ storage, fileFilter });

module.exports = upload;