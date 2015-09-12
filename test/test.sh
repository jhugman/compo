(for n in $(find . | grep "test-.*\.js") ; do echo "require('${n}')" ; done) > index.js
babel-node index.js 
