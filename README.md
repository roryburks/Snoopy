# Snoopy
https://roryburks.000webhostapp.com/snoopy/index.html

Snoopy is Web-Based File Snooper, Hex-viewer combo with the intent of demystifying common file formats.  It does so by displaying the sections of data within the file in a visually-intuitive way while displaying which parts of the hex data it is linked to.  It parses files based on their type, providing a color-coded highlighting of the different sections of the file and providing a two-way link between the file's plain hex representation and a human-readable pressentation of what the data represents, highlighting the section of one whenever you select or mouse-over the other.

Currently supported File Formats:
* GIF, JPG, PNG, TXT


## Notes about building:
Snoopy is written in pure Typescript using only JQuery as an external library.  Any way that you can convert typescript code into javascript code SHOULD successfully convert the code into runnable JS code that just needs to be linked to a fairly recent version of JQuery (currently uses 2.1.4).

However if you want to make use of the provided gulp file and configuration, then install NPM, and following the steps explained in https://www.typescriptlang.org/docs/handbook/gulp.html install the following components into the project folder:

1. Gulp
  * In any folder:
  * `npm install -g gulp-cli`
  * In the project folder:
  * `npm install --save-dev typescript gulp gulp-typescript` 
2. Browserify
  * `npm install --save-dev browserify tsify vinyl-source-stream`

