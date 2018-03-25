module.exports = function (grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    json_language: {
      target: {
        options: {
          check: true,
			    sync: false,
			    unique: true,
			    rev_unused: false,
			    pretty: false,
			    minimum: false,
			    www_out: "build/",
			    eng_file: "en-US.json",
			    ignore: ["languagesList.json"]
        },
        files: [{
          src: 'test/*.json',
          dest: 'build'
        }]
      }
    }
  });

  grunt.loadTasks('tasks');

  grunt.registerTask('test', ['json_language']);
};