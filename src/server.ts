import express from "express";
import cors from "cors";
const jwt = require("jsonwebtoken");
const config = require("../config");
import { knex } from "./lib/knex";
const moment = require('moment');

const PORT = process.env.PORT || 3333;

const HOSTNAME = process.env.HOSTNAME || "http://localhost";

const app = express();

app.use(cors());

app.use(express.json());

app.get("/", (req, res, _next) => {
  res.send({ msg: "servidor rodando" });
});



/**
 * Rota para criar um novo usuário.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.post("/users", async (req, res, _next) => {
  var data = req.body;

  var now = moment().format('YYYY-MM-DD HH:mm:ss');

  if (
    !data.user || !data.password ||
    !data.name || !data.cpf || !data.email || !data.phone ||
    !data.address || !data.number || !data.district || !data.city || !data.state || !data.cep
  ) {
    res.send({msg: "campos obrigatorios nao preenchidos"});
    return;
  }

  const customerExists = await knex.select("id").from("customers").where({ cpf: data.cpf });
  const userExists = await knex.select("customer_id").from("users").where({ user: data.user });

  if (customerExists[0] || userExists[0]) {
    res.send({ msg: "usuario ja existente" });
    return;
  }

  knex("customers").insert({
    name: data.name,
    cpf: data.cpf,
    email: data.email,
    address: data.address,
    number: data.number,
    district: data.district,
    city: data.city,
    state: data.state,
    cep: data.cep,
    phone: data.phone,
  }).then(async () => {
    const createdCustomer = await knex.select("id").from("customers").where({ cpf: data.cpf });
    knex("users").insert({
      customer_id: createdCustomer[0].id,
      user: data.user,
      password: data.password,
      admin: 0,
      last_access: now
    }).then(async () => {
      var token = jwt.sign(
        {
          user: data.user,
          password: data.password,
        },
        config.secretKey
      );
      knex("authentications").insert({
        user_id: createdCustomer[0].id,
        token: token,
      }).then(() => {
          res.send({
            token: token,
            admin: false
          });
        });
    });
  })
})



/**
 * Rota para verificar o token de um usuário.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.post("/users/token", async (req, res, _next) => {
  var data = req.body;

  if (!data.token) {
    res.send({
      msg: "campos obrigatorios nao preenchidos",
      login: false,
    });
    return;
  }

  var login = false;
  var admin = false;

  const authentications = await knex.select("*").from("authentications").where({ token: data.token });

  if (authentications[0]) {
    login = true;
    const user = await knex.select("admin").from("users").where({ customer_id: authentications[0].user_id });
    admin = (user[0].admin) ? true : false;
  } else {
    login = false;
  }

  res.send({
    login: login,
    admin: admin
  });
});



/**
 * Rota para fazer login de um usuário.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.post("/users/login", async (req, res, _next) => {
  var data = req.body;

  if (!data.user || !data.password) {
    res.status(400).send({ msg: "campos obrigatorios nao preenchidos" });
    return;
  }

  const user = await knex.select("*").from("users").where({
    user: data.user,
    password: data.password
  });

  var admin = false;

  if (user[0]) {
    admin = (user[0].admin) ? true : false;

    var token = jwt.sign(
      {
        user: data.user,
        password: data.password,
      },
      config.secretKey
    );

    knex("authentications").insert({
      user_id: user[0].customer_id,
      token: token,
    }).then(() => {
      res.send({
        token: token,
        admin: admin
      });
    });
  } else {
    res.status(400).send({ msg: "usuario e/ou senha incorretos" });
    return;
  }
});



/**
 * Rota para obter todos os produtos.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.get("/products", async (req, res, _next) => {
  const products = await knex.select("*").from("products");
  res.send({ products: products });
});



/**
 * Rota para criar um novo produto.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.post("/products", async (req, res, _next) => {
  var data = req.body;

  if (
    !data.name ||
    !data.price
  ) {
    res.status(400).send({
      msg: "campos obrigatorios nao preenchidos",
    });
    return;
  }

  knex("products").insert({
      name: data.name,
      description: data.description,
      price: data.price
    }).then(async () => {
      res.send({ msg: "Produto criado com sucesso" });
    });
});



/**
 * Rota para atualizar um produto pelo seu ID.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.put("/products/:id", async (req, res, _next) => {
  var data = req.body;
  var id = req.params.id;

  if (!data.name || !data.price) {
    res.status(400).send({ msg: "campos obrigatorios nao preenchidos" });
    return;
  }

  knex("products").where({ id: id }).update({
    name: data.name,
    brand: data.brand,
    price: data.price,
    validity: data.validity,
    description: data.description,
  }).then(() => {
    res.send({ msg: "produto atualizado" });
  });
});



/**
 * Rota para obter um produto pelo seu ID.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.get("/products/:id", async (req, res, _next) => {
  var id = req.params.id;
  const product = await knex.select("*").from("products").where({ id: id });
  res.send(product[0]);
});


app.post("/carts/add/:id", async (req, res, _next) => {
  var token = req.headers.token;
  var product_id = req.params.id;
  var now = moment().format('YYYY-MM-DD HH:mm:ss');

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({ error: true, msg: "token invalido" });
    return;
  } else {
    var user_id = authentications[0].user_id;
    console.log(user_id);
    var activeCart = await knex.select("*").from("orders").where({ customer_id: user_id, status: 0 });
    if (!activeCart[0]) {
      knex("orders").insert({
        creation_time: now,
        total_price: 0,
        status: 0,
        customer_id: user_id
      }).then(async () => {
        activeCart = await knex.select("*").from("orders").where({ customer_id: user_id, status: 0 });
        console.log(activeCart);
      });
    }

    console.log(activeCart);
    
    var activeProductCart = await knex.select("*").from("order_product").where({ order_id: activeCart[0].id, product_id: product_id });

    if (activeProductCart[0]) {
      var newQuantity = Number(activeProductCart[0].quantity) + 1;
      knex("order_product").where({ order_id: activeCart[0].id, product_id: product_id }).update({ quantity: newQuantity }).then(() => {
        res.send({ msg: "Produto adicionado ao carrinho!" });
      });
    } else {
      knex("order_product").insert({
        order_id: activeCart[0].id,
        product_id: product_id,
        quantity: 1,
        unity_value: 0
      }).then(async () => {
        res.send({ msg: "Produto adicionado ao carrinho!" });
      });
    }

  }

});


app.get("/carts", async (req, res, _next) => {
  var token = req.headers.token;

  const authentications = await knex
    .select("user_id")
    .from("authentications")
    .where({
      token: token,
    });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    const carts = await knex.select("*").from("cart").where({
      user_id: user_id,
    });
    res.send({
      carts: carts,
    });
  }
});

app.post("/carts", async (req, res, _next) => {
  var token = req.headers.token;

  const authentications = await knex
    .select("user_id")
    .from("authentications")
    .where({
      token: token,
    });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    knex("cart")
      .insert({
        total_price: 0,
        status: "P",
        user_id: user_id,
      })
      .then(async () => {
        res.send({
          msg: "Carrinho criado com sucesso",
        });
      });
  }
});

app.put("/carts/:id", async (req, res, _next) => {
  var token = req.headers.token;
  var cart_id = req.params.id;
  var data = req.body;

  if (!data.status) {
    res.send({
      error: true,
      msg: "campos obrigatorios nao preenchidos",
    });
    return;
  }

  const authentications = await knex
    .select("user_id")
    .from("authentications")
    .where({
      token: token,
    });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    var found = false;
    const carts = await knex.select("*").from("cart").where({
      user_id: user_id,
    });
    carts.forEach((cart) => {
      if (cart.id == cart_id) {
        found = true;
        knex("cart")
          .where({
            id: cart_id,
          })
          .update({
            status: data.status,
          })
          .then(() => {
            res.send({
              msg: "carrinho atualizado",
            });
          });
      }
    });
    if (!found) {
      res.send({
        error: true,
        msg: "carrinho nao encontrado",
      });
    }
  }
});

app.get("/cart-products/:id", async (req, res, _next) => {
  var token = req.headers.token;
  var cart_id = req.params.id;

  const authentications = await knex
    .select("user_id")
    .from("authentications")
    .where({
      token: token,
    });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    var found = false;
    const carts = await knex.select("*").from("cart").where({
      user_id: user_id,
    });
    carts.forEach((cart) => {
      if (cart.id == cart_id) {
        found = true;
        knex
          .select("*")
          .from("cart-products")
          .where({ cart_id: cart_id })
          .then((response) => {
            var products: any = [];
            Promise.all(
              response.map(async (item) => {
                await knex
                  .select("*")
                  .from("products")
                  .where({ id: item.product_id })
                  .then((details) => {
                    products.push({
                      item,
                      details: details[0],
                    });
                  });
              })
            ).then(() => {
              res.send({
                products: products,
              });
            });
          });
      }
    });
    if (!found) {
      res.send({
        error: true,
        msg: "carrinho nao encontrado",
      });
    }
  }
});

app.post("/cart-products/:id", async (req, res, _next) => {
  var token = req.headers.token;
  var cart_id = req.params.id;
  var data = req.body;

  if (!data.product_id || !data.quantity) {
    res.send({
      error: true,
      msg: "campos obrigatorios nao preenchidos",
    });
    return;
  }

  const authentications = await knex
    .select("user_id")
    .from("authentications")
    .where({
      token: token,
    });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    var found = false;
    const carts = await knex.select("*").from("cart").where({
      user_id: user_id,
    });
    carts.forEach((cart) => {
      if (cart.id == cart_id) {
        found = true;

        knex
          .select("*")
          .from("products")
          .where({
            id: data.product_id,
          })
          .then(async (product) => {
            var total_price = product[0].price * data.quantity;
            var cartProduct = await knex
              .select("*")
              .from("cart-products")
              .where({
                cart_id: cart_id,
                product_id: data.product_id,
              });
            if (cartProduct[0]) {
              knex("cart-products")
                .where({
                  cart_id: cart_id,
                  product_id: data.product_id,
                })
                .update({
                  quantity: data.quantity,
                  unity_price: product[0].price,
                  total_price: total_price,
                })
                .then(() => {
                  res.send({
                    msg: "produto atualizado no carrinho",
                  });
                });
            } else {
              knex("cart-products")
                .insert({
                  cart_id: cart_id,
                  product_id: data.product_id,
                  quantity: data.quantity,
                  unity_price: product[0].price,
                  total_price: total_price,
                })
                .then(() => {
                  res.send({
                    msg: "produto adicionado ao carrinho",
                  });
                });
            }
          });
      }
    });
    if (!found) {
      res.send({
        error: true,
        msg: "carrinho nao encontrado",
      });
    }
  }
});

app.delete("/cart-products/:id", async (req, res, _next) => {
  var token = req.headers.token;
  var cart_id = req.params.id;
  var data = req.body;

  if (!data.product_id) {
    res.send({
      error: true,
      msg: "campos obrigatorios nao preenchidos",
    });
    return;
  }

  const authentications = await knex
    .select("user_id")
    .from("authentications")
    .where({
      token: token,
    });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    var found = false;
    const carts = await knex.select("*").from("cart").where({
      user_id: user_id,
    });
    carts.forEach((cart) => {
      if (cart.id == cart_id) {
        found = true;
        knex("cart-products")
          .where({
            cart_id: cart_id,
            product_id: data.product_id,
          })
          .del()
          .then(() => {
            res.send({
              msg: "produto removido do carrinho com sucesso",
            });
          });
      }
    });
    if (!found) {
      res.send({
        error: true,
        msg: "carrinho nao encontrado",
      });
    }
  }
});

app.use((_req, res) => {
  res.status(404);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando com sucesso ${HOSTNAME}:${PORT}`);
});
