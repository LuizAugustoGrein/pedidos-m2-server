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
        error: false,
        token: token,
        admin: admin
      });
    });
  } else {
    res.send({ error: true, msg: "Usuario e/ou senha incorretos" });
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

  var token = req.headers.token;

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({ error: true, msg: "token invalido" });
    return;
  } else {
    var user_id = authentications[0].user_id;
    const user = await knex.select("*").from("users").where({ customer_id: user_id });

    if(user[0].admin) {
      if ( !data.name || !data.price ) {
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
    } else {
      res.send({ msg: "usuario nao administrador" });
    }
  }
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

  var token = req.headers.token;

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({ error: true, msg: "token invalido" });
    return;
  } else {
    var user_id = authentications[0].user_id;
    const user = await knex.select("*").from("users").where({ customer_id: user_id });

    if(user[0].admin) {
      if (!data.name || !data.price) {
        res.status(400).send({ msg: "campos obrigatorios nao preenchidos" });
        return;
      }
    
      knex("products").where({ id: id }).update({
        name: data.name,
        price: data.price,
        description: data.description,
      }).then(() => {
        res.send({ msg: "produto atualizado" });
      });
    } else {
      res.send({ msg: "usuario nao administrador" });
    }
  }  
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



/**
 * Rota para adicionar um produto ao carrinho.
 *
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
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
    var activeCart = await knex.select("*").from("orders").where({ customer_id: user_id, status: 0 });
    if (!activeCart[0]) {
      await knex("orders").insert({
        creation_time: now,
        total_price: 0,
        status: 0,
        customer_id: user_id
      }).then(async () => {
        activeCart = await knex.select("*").from("orders").where({ customer_id: user_id, status: 0 });
      });
    }
    
    var activeProductCart = await knex.select("*").from("order_product").where({ order_id: activeCart[0].id, product_id: product_id });

    const product = await knex.select("*").from("products").where({ id: product_id });

    if (activeProductCart[0]) {
      var newQuantity = Number(activeProductCart[0].quantity) + 1;
      knex("order_product").where({ order_id: activeCart[0].id, product_id: product_id }).update({ quantity: newQuantity, unity_value: product[0].price }).then( async () => {
        await calculateCartTotal(activeCart[0].id);
        res.send({ msg: "Produto adicionado ao carrinho!" });
      });
    } else {
      knex("order_product").insert({
        order_id: activeCart[0].id,
        product_id: product_id,
        quantity: 1,
        unity_value: product[0].price
      }).then(async () => {
        await calculateCartTotal(activeCart[0].id);
        res.send({ msg: "Produto adicionado ao carrinho!" });
      });
    }
  }
});



/**
 * Rota para diminuir um produto do carrinho.
 *
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.post("/carts/decrease/:id", async (req, res, _next) => {
  var token = req.headers.token;
  var product_id = req.params.id;

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({ error: true, msg: "token invalido" });
    return;
  } else {
    var user_id = authentications[0].user_id;
    var activeCart = await knex.select("*").from("orders").where({ customer_id: user_id, status: 0 });
    
    var activeProductCart = await knex.select("*").from("order_product").where({ order_id: activeCart[0].id, product_id: product_id });

    const product = await knex.select("*").from("products").where({ id: product_id });

    if (activeProductCart[0].quantity <= 1) {
      knex("order_product").where({order_id: activeCart[0].id, product_id: product_id }).del().then( async () => {
        await calculateCartTotal(activeCart[0].id);
        res.send({ msg: "Produto removido do carrinho!" });
      });
    } else {
      var newQuantity = Number(activeProductCart[0].quantity) - 1;
      knex("order_product").where({ order_id: activeCart[0].id, product_id: product_id }).update({ quantity: newQuantity, unity_value: product[0].price }).then( async () => {
        await calculateCartTotal(activeCart[0].id);
        res.send({ msg: "Produto diminuido do carrinho!" });
      });
    }
  }
});



/**
 * Retorna o carrinho de compras e os produtos associados para um usuário autenticado.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.get("/cart", async (req, res, _next) => {
  var token = req.headers.token;

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    var activeCart = await knex.select("*").from("orders").where({ customer_id: user_id, status: 0 });
    if (activeCart[0]) {
      var products: any = [];
      await knex.select("*").from("order_product").where({ order_id: activeCart[0].id }).then(async (activeProducts) => {
        var index = 0;
        await activeProducts.forEach(async (current) => {
          await knex.select("*").from("products").where({ id: current.product_id }).then((productDetails) => {
            current.details = productDetails[0];
            products.push(current);
            if (index === activeProducts.length - 1) {
              products.sort(function compare(a, b) {
                if (a.product_id < b.product_id) return -1;
                if (a.product_id > b.product_id) return 1;
                return 0;
              })
              activeCart[0].products = products

              res.send(activeCart[0])
            }
            index++;
          });
        });
      });
    } else {
      res.send({ error: true })
    }
  }
});



/**
 * Retorna o carrinho de compras e os produtos associados para um usuário autenticado.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.post("/order/submit", async (req, res, _next) => {
  var token = req.headers.token;

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    var activeCart = await knex.select("*").from("orders").where({ customer_id: user_id, status: 0 });
    if (activeCart[0]) {
      await knex("orders").where({ id: activeCart[0].id }).update({ status: 1 }).then(() => {
        res.send({
          error: false,
          msg: "pedido realizado com sucesso!",
        });
      });
    } else {
      res.send({ error: true })
    }
  }
});



/**
 * Calcula o total do carrinho de compras com base no ID do pedido.
 *
 * @param {number} order_id - O ID do pedido para o qual o total do carrinho será calculado.
 * @returns {Promise<void>} - Uma promessa vazia.
 */
async function calculateCartTotal(order_id) {
  var priceTotal = 0;

  var activeProducts = await knex.select("*").from("order_product").where({ order_id: order_id });

  activeProducts.forEach(activeProduct => {
    priceTotal += activeProduct.quantity * activeProduct.unity_value;
  });

  var now = moment().format('YYYY-MM-DD HH:mm:ss');

  await knex("orders").where({ id: order_id }).update({ total_price: priceTotal, update_time: now });

  return;
}



/**
 * Retorna todos os pedidos do usuário autenticado.
 *
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.get("/orders", async (req, res, _next) => {
  var token = req.headers.token;

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({
      error: true,
      msg: "token invalido",
    });
    return;
  } else {
    var user_id = authentications[0].user_id;
    const orders = await knex.select("*").from("orders").where({ customer_id: user_id, status: 1 }).orderBy('id', 'desc');
    res.send({ orders: orders });
  }
});



/**
 * Retorna um pedido em específico para o usuário autenticado
 *
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.get("/order/:id", async (req, res, _next) => {
  var order_id = req.params.id;

  var token = req.headers.token;

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({ error: true, msg: "token invalido" });
    return;
  } else {
    var user_id = authentications[0].user_id;
    var order = await knex.select("*").from("orders").where({ customer_id: user_id, id: order_id });
    if (order[0]) {
      var products: any = [];
      await knex.select("*").from("order_product").where({ order_id: order[0].id }).then(async (activeProducts) => {
        var index = 0;
        await activeProducts.forEach(async (current) => {
          await knex.select("*").from("products").where({ id: current.product_id }).then((productDetails) => {
            current.details = productDetails[0];
            products.push(current);
            if (index === activeProducts.length - 1) {
              products.sort(function compare(a, b) {
                if (a.product_id < b.product_id) return -1;
                if (a.product_id > b.product_id) return 1;
                return 0;
              })
              order[0].products = products

              res.send(order[0])
            }
            index++;
          });
        });
      });
    } else {
      res.send({ error: true })
    }
  }
});



/**
 * Obtém as informações do cliente autenticado.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} _next - Função de middleware do Express
 * @returns {JSON}
 */
app.get("/customer", async (req, res, _next) => {
  var token = req.headers.token;

  const authentications = await knex.select("user_id").from("authentications").where({ token: token });

  if (!authentications[0]) {
    res.send({ error: true, msg: "token invalido" });
    return;
  } else {
    var user_id = authentications[0].user_id;
    await knex.select("*").from("customers").where({ id: user_id }).then((customer) => {
      res.send(customer[0]);
    });
  }
});



/**
 * Caso uma rota não exista
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @returns {JSON}
 */
app.use((_req, res) => {
  res.status(404);
});



app.listen(PORT, () => {
  console.log(`Servidor rodando com sucesso ${HOSTNAME}:${PORT}`);
});
