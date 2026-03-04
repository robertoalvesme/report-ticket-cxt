py -m pip install pandas xlrd openpyxl

py validar_chamados.py 


# Docker 

## Rebuild Backend Server
docker compose up -d --build app

## Rebuild Frontend Server
docker compose up -d --build frontend

## Rebuild All
docker compose down
docker compose up -d --build

## Limpar o banco de dados
docker exec -it ocd_db mongosh "mongodb://localhost:27017/dashboard_ocd" --eval "db.dropDatabase()"

## Marcar todos os tickets para reprocessamento
docker exec -it ocd_db mongosh "mongodb://localhost:27017/dashboard_ocd" --eval 'db.tickets.updateMany({}, { $set: { updated: false } })'

# Mongo Queries

## Verificar Tickets Pendentes
docker exec ocd_db mongosh dashboard_ocd --quiet --eval 'printjson({ Total: db.tickets.countDocuments({}), Atualizados: db.tickets.countDocuments({ updated: true }), Pendentes: db.tickets.countDocuments({ updated: { $ne: true } }) })'

## Obter dados de SR
db.tickets.find({ "activity_number": "1-23493354272" }).pretty();