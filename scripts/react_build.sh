cd react
rm -rf build
npm install
PUBLIC_URL=/api/react npm run build
cd ..

REACT_BUILD_DIR=react/build
TMPFILE=/tmp/react_$$.tmp
MAIN_JS_HASHED_FILE=`ls ${REACT_BUILD_DIR}/static/js/main.*.js`
MAIN_JS_HASHED_FILE_NAME=`basename ${MAIN_JS_HASHED_FILE}`
MAIN_CSS_HASHED_FILE=`ls ${REACT_BUILD_DIR}/static/css/main.*.css`
MAIN_CSS_HASHED_FILE_NAME=`basename ${MAIN_CSS_HASHED_FILE}`

sed -e "s/${MAIN_JS_HASHED_FILE_NAME}/main.js/g" < ${REACT_BUILD_DIR}/index.html > ${TMPFILE}
mv ${TMPFILE} ${REACT_BUILD_DIR}/index.html
sed -e "s/${MAIN_JS_HASHED_FILE_NAME}/main.js/g" < ${REACT_BUILD_DIR}/asset-manifest.json > ${TMPFILE}
mv ${TMPFILE} ${REACT_BUILD_DIR}/asset-manifest.json
mv ${MAIN_JS_HASHED_FILE} ${REACT_BUILD_DIR}/static/js/main.js

sed -e "s/${MAIN_CSS_HASHED_FILE_NAME}/main.css/g" < ${REACT_BUILD_DIR}/index.html > ${TMPFILE}
mv ${TMPFILE} ${REACT_BUILD_DIR}/index.html
sed -e "s/${MAIN_CSS_HASHED_FILE_NAME}/main.css/g" < ${REACT_BUILD_DIR}/asset-manifest.json > ${TMPFILE}
mv ${TMPFILE} ${REACT_BUILD_DIR}/asset-manifest.json
mv ${MAIN_CSS_HASHED_FILE} ${REACT_BUILD_DIR}/static/css/main.css

rm -f ${REACT_BUILD_DIR}/static/js/*.LICENSE.txt

rm -rf foursight_core/react
mkdir foursight_core/react
cp -pR react/build/* foursight_core/react
