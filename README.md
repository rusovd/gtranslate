# gtranslate
Translate JSON files in i18n format using Google Translate



Use this instructions to register your app and get a key:

https://cloud.google.com/translate/docs/quickstart-client-libraries



Save your key to project's folder and rename it to *gapi-key.json*



Change the constructor(line #5) of translate using your APP id

_const translate = new Translate({ 'ID': 'Z-XXXXX-YYYYYYYYYYY' });_



npm install

node trans