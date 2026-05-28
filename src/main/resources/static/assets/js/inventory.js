// Goods Stock Engine & F&B OutOfStock Managers
import { DB, publish, saveDB } from './store.js';

// Calculate Available Stock: Current - PreAllocated
export function getGoodsAvailableStock(goodsId) {
  const item = DB.goods.find(g => g.id === goodsId);
  if (!item) return 0;
  return item.currentStock - item.preAllocated;
}

// Attempts to pre-allocate (lock) stock when checkout starts
export function lockGoodsStock(goodsId, quantity) {
  const item = DB.goods.find(g => g.id === goodsId);
  if (!item) return { success: false, error: "상품을 찾을 수 없습니다." };

  const available = item.currentStock - item.preAllocated;
  if (available < quantity) {
    return { 
      success: false, 
      error: `선점 가능한 재고가 부족합니다! (현재 가용 재고: ${available}개)` 
    };
  }

  // Lock stock temporarily
  item.preAllocated += quantity;
  saveDB();
  
  publish("inventory-change", {
    id: item.id,
    name: item.name,
    stock: item.currentStock,
    preAllocated: item.preAllocated,
    available: item.currentStock - item.preAllocated
  });
  
  return { success: true, item };
}

// Release pre-allocated stock back (e.g. checkout canceled or failed)
export function unlockGoodsStock(goodsId, quantity) {
  const item = DB.goods.find(g => g.id === goodsId);
  if (!item) return { success: false };

  item.preAllocated = Math.max(0, item.preAllocated - quantity);
  saveDB();

  publish("inventory-change", {
    id: item.id,
    name: item.name,
    stock: item.currentStock,
    preAllocated: item.preAllocated,
    available: item.currentStock - item.preAllocated
  });

  return { success: true, item };
}

// Finalize purchase: deduct physically from current stock and release allocation
export function finalizeGoodsPurchase(goodsId, quantity) {
  const item = DB.goods.find(g => g.id === goodsId);
  if (!item) return { success: false };

  item.currentStock = Math.max(0, item.currentStock - quantity);
  item.preAllocated = Math.max(0, item.preAllocated - quantity);
  saveDB();

  publish("inventory-change", {
    id: item.id,
    name: item.name,
    stock: item.currentStock,
    preAllocated: item.preAllocated,
    available: item.currentStock - item.preAllocated
  });

  return { success: true, item };
}

// Register or Update Goods Stock
export function updateGoodsStock(goodsId, newStock) {
  const item = DB.goods.find(g => g.id === goodsId);
  if (!item) return { success: false };

  item.currentStock = parseInt(newStock) || 0;
  saveDB();

  publish("inventory-change", {
    id: item.id,
    name: item.name,
    stock: item.currentStock,
    preAllocated: item.preAllocated,
    available: item.currentStock - item.preAllocated
  });

  return { success: true, item };
}

// Add new Goods item
export function registerGoods(name, price, stock, image = "") {
  const newId = `g${DB.goods.length + 1}`;
  const newItem = {
    id: newId,
    name,
    price: parseInt(price) || 0,
    currentStock: parseInt(stock) || 0,
    preAllocated: 0,
    image
  };
  
  DB.goods.push(newItem);
  saveDB();
  
  publish("inventory-change", {
    id: newItem.id,
    name: newItem.name,
    stock: newItem.currentStock,
    preAllocated: 0,
    available: newItem.currentStock
  });
  
  return newItem;
}

// Toggle Restaurant Food Item Ingredient Out (재료소진)
export function toggleFoodIngredientOut(foodId) {
  const item = DB.food.find(f => f.id === foodId);
  if (!item) return null;

  item.outOfStock = !item.outOfStock;
  saveDB();

  publish("food-soldout", {
    id: item.id,
    name: item.name,
    outOfStock: item.outOfStock
  });

  return item;
}

// Register or edit Food menu item
export function registerFood(name, price, image = "") {
  const newId = `f${DB.food.length + 1}`;
  const newItem = {
    id: newId,
    name,
    price: parseInt(price) || 0,
    outOfStock: false,
    image
  };
  
  DB.food.push(newItem);
  saveDB();
  
  publish("food-soldout", {
    id: newItem.id,
    name: newItem.name,
    outOfStock: false
  });
  
  return newItem;
}

// Option and Season Rates management
export function updateSeasonalPrice(seasonId, newBasePrice) {
  const season = DB.options.seasons.find(s => s.id === seasonId);
  if (season) {
    season.basePrice = parseInt(newBasePrice) || 0;
    saveDB();
    return true;
  }
  return false;
}

export function toggleActiveSeason(seasonId) {
  DB.options.seasons.forEach(s => {
    s.active = (s.id === seasonId);
  });
  saveDB();
}
