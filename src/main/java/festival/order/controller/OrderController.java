package festival.order.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;

@RestController
@RequestMapping("/api/order")
public class OrderController {
    
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/fnb")
    public List<Map<String, Object>> getFnbOrders() {
        String sql = "SELECT oi.id as item_id, p.name as product_name, oi.quantity, p.price, oi.item_status, oi.updated_at " +
                     "FROM order_item oi " +
                     "JOIN product p ON oi.product_id = p.id " +
                     "WHERE oi.product_type = 'FOOD' " +
                     "ORDER BY oi.updated_at DESC";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> order = new HashMap<>();
            
            Long itemId = ((Number) row.get("item_id")).longValue();
            order.put("id", "ORD-ITEM-" + itemId);
            order.put("type", "FOOD");
            
            String itemStatus = (String) row.get("item_status");
            if (itemStatus == null || itemStatus.equals("ORDERED") || itemStatus.equals("PAID") || itemStatus.isEmpty()) {
                itemStatus = "RECEIVED";
            }
            order.put("status", itemStatus);
            
            order.put("customer", "고객 (ID:" + itemId + ")");
            order.put("timestamp", row.get("updated_at") != null ? row.get("updated_at").toString() : "");
            
            List<Map<String, Object>> items = new ArrayList<>();
            Map<String, Object> item = new HashMap<>();
            item.put("name", row.get("product_name"));
            item.put("quantity", row.get("quantity"));
            items.add(item);
            
            order.put("items", items);
            
            int itemPrice = row.get("price") != null ? ((Number) row.get("price")).intValue() : 0;
            int quantity = row.get("quantity") != null ? ((Number) row.get("quantity")).intValue() : 1;
            order.put("price", itemPrice * quantity);
            
            result.add(order);
        }
        
        return result;
    }

    @PutMapping("/fnb/{id}/status")
    public Map<String, String> updateFnbStatus(@PathVariable("id") String idStr, @RequestBody Map<String, String> payload) {
        String nextStatus = payload.get("status");
        Long itemId = Long.parseLong(idStr.replace("ORD-ITEM-", ""));
        
        String sql = "UPDATE order_item SET item_status = ? WHERE id = ?";
        jdbcTemplate.update(sql, nextStatus, itemId);
        
        Map<String, String> res = new HashMap<>();
        res.put("status", "success");
        return res;
    }

    @GetMapping("/goods")
    public List<Map<String, Object>> getGoodsOrders() {
        String sql = "SELECT oi.id as item_id, p.name as product_name, oi.quantity, p.price, oi.item_status, oi.updated_at " +
                     "FROM order_item oi " +
                     "JOIN product p ON oi.product_id = p.id " +
                     "WHERE oi.product_type = 'GOODS' " +
                     "ORDER BY oi.updated_at DESC";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> order = new HashMap<>();
            
            Long itemId = ((Number) row.get("item_id")).longValue();
            order.put("id", "ORD-ITEM-" + itemId);
            order.put("type", "GOODS");
            
            String itemStatus = (String) row.get("item_status");
            if (itemStatus == null) itemStatus = "ORDERED";
            order.put("status", itemStatus);
            
            order.put("customer", "고객 (ID:" + itemId + ")");
            order.put("timestamp", row.get("updated_at") != null ? row.get("updated_at").toString() : "");
            
            List<Map<String, Object>> items = new ArrayList<>();
            Map<String, Object> item = new HashMap<>();
            item.put("name", row.get("product_name"));
            item.put("quantity", row.get("quantity"));
            items.add(item);
            
            order.put("items", items);
            
            int itemPrice = row.get("price") != null ? ((Number) row.get("price")).intValue() : 0;
            int quantity = row.get("quantity") != null ? ((Number) row.get("quantity")).intValue() : 1;
            order.put("price", itemPrice * quantity);
            
            result.add(order);
        }
        
        return result;
    }

    @PutMapping("/goods/{id}/status")
    public Map<String, String> updateGoodsStatus(@PathVariable("id") String idStr, @RequestBody Map<String, String> payload) {
        String nextStatus = payload.get("status");
        Long itemId = Long.parseLong(idStr.replace("ORD-ITEM-", ""));
        
        String sql = "UPDATE order_item SET item_status = ? WHERE id = ?";
        jdbcTemplate.update(sql, nextStatus, itemId);
        
        Map<String, String> res = new HashMap<>();
        res.put("status", "success");
        return res;
    }

    @GetMapping("/seats")
    public List<Map<String, Object>> getAllSeats(@RequestParam(value = "zones", required = false) String zonesParam) {
        String sql = "SELECT SUBSTRING(seat_row, 1, 1) as zone, seat_number, is_reserved " +
                     "FROM seat_map ";
                     
        List<Map<String, Object>> rows;
        if (zonesParam != null && !zonesParam.isEmpty()) {
            List<String> zonesList = Arrays.asList(zonesParam.split(","));
            String inSql = String.join(",", Collections.nCopies(zonesList.size(), "?"));
            sql += "WHERE SUBSTRING(seat_row, 1, 1) IN (" + inSql + ") ";
            sql += "ORDER BY zone, seat_number";
            rows = jdbcTemplate.queryForList(sql, zonesList.toArray());
        } else {
            sql += "ORDER BY zone, seat_number";
            rows = jdbcTemplate.queryForList(sql);
        }
        
        List<Map<String, Object>> allSeats = new ArrayList<>();
        
        for (Map<String, Object> row : rows) {
            Map<String, Object> seat = new HashMap<>();
            String zone = (String) row.get("zone");
            Number number = (Number) row.get("seat_number");
            Boolean isReserved = (Boolean) row.get("is_reserved");
            
            seat.put("id", zone + "-" + number);
            seat.put("zone", zone);
            seat.put("number", number);
            seat.put("isReserved", isReserved);
            allSeats.add(seat);
        }
        
        return allSeats;
    }

    // -------------------------------------------------------------
    // [메모리(RAM) 기반 QR 텍스트 임시 보관소] - DB 저장 안 함!
    // -------------------------------------------------------------
    private static final Map<Long, Map<String, String>> qrMemoryStore = new java.util.concurrent.ConcurrentHashMap<>();

    private String generateRandomTicketNumber() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder("TKT-");
        Random rnd = new Random();
        for (int i = 0; i < 4; i++) sb.append(chars.charAt(rnd.nextInt(chars.length())));
        sb.append("-");
        for (int i = 0; i < 4; i++) sb.append(chars.charAt(rnd.nextInt(chars.length())));
        return sb.toString();
    }

    @PostMapping("/ticket")
    public Map<String, Object> createTicketOrder(@RequestBody Map<String, Object> payload) {
        int totalPrice = (Integer) payload.get("totalPrice");
        List<String> seats = (List<String>) payload.get("seats");
        String seatIdsStr = String.join(", ", seats);
        
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                "INSERT INTO orders (user_id, festival_id, total_price, payment_status, created_at, seat_ids) VALUES (1, 1, ?, 'PAID', NOW(), ?)", 
                new String[] {"id"});
            ps.setInt(1, totalPrice);
            ps.setString(2, seatIdsStr);
            return ps;
        }, keyHolder);
        
        Number key = keyHolder.getKey();
        Long orderId = key != null ? key.longValue() : 1L;
        
        for (String seat : seats) {
            String zone = seat.split("-")[0];
            int number = Integer.parseInt(seat.split("-")[1]);
            
            try {
                jdbcTemplate.update(
                    "UPDATE seat_map SET is_reserved = true WHERE seat_row LIKE ? AND seat_number = ?", 
                    zone + "%", number);
            } catch (Exception e) {
                // Ignore
            }
        }
        
        // 메모리에 QR 텍스트 데이터 및 고유 난수 등록
        String ticketNum = generateRandomTicketNumber();
        String qrPayload = "FESTIO:TICKET:" + ticketNum + ":ORD" + orderId;
        
        Map<String, String> qrData = new HashMap<>();
        qrData.put("ticketNumber", ticketNum);
        qrData.put("qrPayload", qrPayload);
        qrData.put("seats", seatIdsStr);
        qrMemoryStore.put(orderId, qrData);
        
        Map<String, Object> res = new HashMap<>();
        res.put("status", "success");
        res.put("orderId", orderId);
        res.put("ticketNumber", ticketNum);
        res.put("qrPayload", qrPayload);
        return res;
    }

    @GetMapping("/tickets/qr")
    public List<Map<String, Object>> getQrTickets() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<Long, Map<String, String>> entry : qrMemoryStore.entrySet()) {
            Map<String, Object> map = new HashMap<>();
            map.put("orderId", entry.getKey());
            map.putAll(entry.getValue());
            result.add(map);
        }
        // 최신 순 정렬
        result.sort((a, b) -> ((Long) b.get("orderId")).compareTo((Long) a.get("orderId")));
        return result;
    }
    @PostMapping("/tickets/scan")
    public Map<String, Object> scanQrTicket(@RequestBody Map<String, String> payload) {
        String qrText = payload.get("qrText");
        Map<String, Object> res = new HashMap<>();
        
        Long foundOrderId = null;
        Map<String, String> foundData = null;
        
        for (Map.Entry<Long, Map<String, String>> entry : qrMemoryStore.entrySet()) {
            if (qrText.equals(entry.getValue().get("qrPayload"))) {
                foundOrderId = entry.getKey();
                foundData = entry.getValue();
                break;
            }
        }
        
        if (foundOrderId == null) {
            res.put("status", "INVALID");
            res.put("message", "존재하지 않거나 올바르지 않은 QR 티켓입니다.");
            return res;
        }
        
        if ("true".equals(foundData.get("used"))) {
            res.put("status", "ALREADY_ENTERED");
            res.put("message", "이미 입장 처리된 티켓입니다! (중복 입장 불가)");
            res.put("seats", foundData.get("seats"));
            return res;
        }
        
        foundData.put("used", "true");
        res.put("status", "VALID");
        res.put("message", "유효성 검증 성공! 입장 처리되었습니다. (좌석: " + foundData.get("seats") + ")");
        res.put("seats", foundData.get("seats"));
        
        return res;
    }

    @GetMapping("/tickets")
    public List<Map<String, Object>> getTicketOrders() {
        String sql = "SELECT id, total_price, payment_status, created_at, seat_ids " +
                     "FROM orders " +
                     "WHERE seat_ids IS NOT NULL " +
                     "ORDER BY created_at DESC";
        
        return jdbcTemplate.queryForList(sql);
    }

    @PutMapping("/tickets/{id}/status")
    public Map<String, String> updateTicketStatus(@PathVariable("id") Long id, @RequestBody Map<String, String> payload) {
        String nextStatus = payload.get("status");
        jdbcTemplate.update("UPDATE orders SET payment_status = ? WHERE id = ?", nextStatus, id);
        
        if ("REFUNDED".equals(nextStatus)) {
            // 메모리에서 해당 티켓 데이터 삭제 (환불됨)
            qrMemoryStore.remove(id);
            try {
                String seatIdsStr = jdbcTemplate.queryForObject(
                    "SELECT seat_ids FROM orders WHERE id = ?", String.class, id);
                if (seatIdsStr != null && !seatIdsStr.isEmpty()) {
                    String[] seats = seatIdsStr.split(",");
                    for (String s : seats) {
                        String seat = s.trim();
                        if (seat.contains("-")) {
                            String zone = seat.split("-")[0];
                            int number = Integer.parseInt(seat.split("-")[1]);
                            jdbcTemplate.update(
                                "UPDATE seat_map SET is_reserved = false WHERE seat_row LIKE ? AND seat_number = ?", 
                                zone + "%", number);
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        
        Map<String, String> res = new HashMap<>();
        res.put("status", "success");
        return res;
    }
}
