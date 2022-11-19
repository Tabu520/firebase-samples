const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();
const braintree = require("braintree");
const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');

const validateFirebaseTokenId = async (req, res, next) => {
    console.log("Checking");
    if((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer'))
        && !(req.cookies && req.cookies.__session)) {
        res.status(403).send('Unauthorized');
        return;
    }
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        idToken = req.headers.authorization.split('Bearer ')[1];

    } else if(req.cookies) {
        idToken = req.cookies.__session;
    } else {
        res.status(403).send('Unauthorized');
        return;
    }

    try {
        const decodedIdToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedIdToken;
        next();
        return;
    } catch(error) {
        res.status(403).send('Unauthorized');
        return;
    }
}

// Init app
const app = express();
app.use(cors({origin: true}));
// app.use(cookieParser);
app.use(validateFirebaseTokenId);

/*const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: "scj9qyrpv497hq2h",
  publicKey: "tdzc57kzrrw4k8kz",
  privateKey: "4e9af0dcc5783acbc6dadb4cb98f5917",
});*/
var gateway = braintree.connect({
    environment:  braintree.Environment.Sandbox,
    merchantId:   'scj9qyrpv497hq2h',
    publicKey:    'tdzc57kzrrw4k8kz',
    privateKey:   '4e9af0dcc5783acbc6dadb4cb98f5917'
});

app.get("/token", (request, response) => {
  gateway.clientToken.generate({}, (err, res) => {
    if (res) {
      response.send(JSON.stringify({error: false, token: res.clientToken}));
    } else {
      response.send(JSON.stringify({error: true, errObj: err, response: res}));
    }
  });
});

app.post("/checkout", (request, response) => {
  let transactionErrors;
  const amount = request.body.amount;
  const nonce = request.body.payment_method_nonce;

  gateway.transaction.sale(
      {
        amount: amount,
        paymentMethodNonce: nonce,
        options: {
          submitForSettlement: true,
        },
      },
      (error, result) => {
        if (result.success || result.transaction) {
          response.send(JSON.stringify(result));
        } else {
          transactionErrors = result.errors.deepErrors();
          response.send(JSON.stringify(formatErrors(transactionErrors)));
        }
      }
  );
});

exports.widgets = functions.https.onRequest(app);
