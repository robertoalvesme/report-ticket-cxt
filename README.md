py -m pip install pandas xlrd openpyxl

py validar_chamados.py 


# Mongo Queries

## Verificar Tickets Pendentes
docker exec ocd_db mongosh dashboard_ocd --quiet --eval 'printjson({ Total: db.tickets.countDocuments({}), Atualizados: db.tickets.countDocuments({ updated: true }), Pendentes: db.tickets.countDocuments({ updated: { $ne: true } }) })'

## Obter dados de SR
db.tickets.find({ "activity_number": "1-23493354272" }).pretty();